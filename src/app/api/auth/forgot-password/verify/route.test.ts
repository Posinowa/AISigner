import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock, verifyMock, hashMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
  verifyMock: vi.fn(),
  hashMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@node-rs/argon2", () => ({
  verify: (...args: unknown[]) => verifyMock(...args),
  hash: (...args: unknown[]) => hashMock(...args),
}));

import { POST } from "./route";

/** Kayıtlı 3 güvenlik cevabı olan kullanıcı. Hash'ler "hash:<cevap>" formatında. */
function userWithAnswers() {
  return {
    id: "user-1",
    securityAnswers: [
      { questionId: 0, answer: "hash:tekir" },
      { questionId: 1, answer: "hash:ataturk" },
      { questionId: 2, answer: "hash:yilmaz" },
    ],
  };
}

/** argon2.verify taklidi: stored "hash:x" ise yalnızca "x" doğrudur. */
function realisticVerify() {
  verifyMock.mockImplementation(async (stored: string, candidate: string) => {
    return stored === `hash:${candidate}`;
  });
}

let ipCounter = 0;
function req(body: unknown, ip?: string) {
  // Her test kendi IP'sini kullanır — rate limiter proses-yerel ve testler arası taşar.
  return new Request("http://test/api/auth/forgot-password/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": ip ?? `10.0.0.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

/** Her testte benzersiz e-posta — hesap bazlı limit testler arası taşmasın. */
let emailCounter = 0;
const freshEmail = () => `user${++emailCounter}@test.com`;

describe("forgot-password/verify (#149)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashMock.mockResolvedValue("hashed-new-password");
  });

  describe("cevap tekilleştirme — tek cevabı bilen geçemez", () => {
    it("aynı doğru cevap 3 kez gönderilirse doğrulama BAŞARISIZ olur", async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      realisticVerify();

      const res = await POST(
        req({
          email: freshEmail(),
          answers: [
            { questionId: 0, answer: "tekir" },
            { questionId: 0, answer: "tekir" },
            { questionId: 0, answer: "tekir" },
          ],
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).not.toHaveProperty("resetToken");
    });

    it("üç FARKLI sorunun doğru cevabı → resetToken verilir", async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      realisticVerify();

      const res = await POST(
        req({
          email: freshEmail(),
          answers: [
            { questionId: 0, answer: "tekir" },
            { questionId: 1, answer: "ataturk" },
            { questionId: 2, answer: "yilmaz" },
          ],
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.step).toBe("verified");
      expect(json.resetToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it("iki doğru + bir yanlış → geçemez", async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      realisticVerify();

      const res = await POST(
        req({
          email: freshEmail(),
          answers: [
            { questionId: 0, answer: "tekir" },
            { questionId: 1, answer: "ataturk" },
            { questionId: 2, answer: "yanlis" },
          ],
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  describe("hesap ifşası (enumeration)", () => {
    it("kayıtsız hesap için sorular tekrarlanabilir — iki istek AYNI üçlüyü döndürür", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      const email = freshEmail();

      const first = await (await POST(req({ email }))).json();
      const second = await (await POST(req({ email }))).json();

      expect(first.step).toBe("questions");
      expect(first.questions).toHaveLength(3);
      expect(second.questions).toEqual(first.questions);
    });

    it("farklı e-postalar farklı sahte sorular alır", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const a = await (await POST(req({ email: "aaa@test.com" }))).json();
      const b = await (await POST(req({ email: "zzz@test.com" }))).json();

      expect(a.questions).not.toEqual(b.questions);
    });

    it("kayıtsız hesapta da argon2 doğrulaması çalışır (sabit zaman)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      verifyMock.mockResolvedValue(false);

      const res = await POST(
        req({
          email: freshEmail(),
          answers: [
            { questionId: 0, answer: "a" },
            { questionId: 1, answer: "b" },
            { questionId: 2, answer: "c" },
          ],
        }),
      );

      expect(res.status).toBe(400);
      expect(verifyMock).toHaveBeenCalledTimes(3);
    });

    it("kayıtsız hesabın hata mesajı kayıtlı hesapla aynıdır", async () => {
      verifyMock.mockResolvedValue(false);
      const answers = [
        { questionId: 0, answer: "x" },
        { questionId: 1, answer: "y" },
        { questionId: 2, answer: "z" },
      ];

      prismaMock.user.findUnique.mockResolvedValue(null);
      const missing = await (await POST(req({ email: freshEmail(), answers }))).json();

      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      const existing = await (await POST(req({ email: freshEmail(), answers }))).json();

      expect(missing.error).toContain("Güvenlik sorusu cevapları yanlış");
      expect(existing.error).toContain("Güvenlik sorusu cevapları yanlış");
    });
  });

  describe("resetToken zorunluluğu", () => {
    it("token olmadan yeni şifre gönderilemez", async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      realisticVerify();

      const res = await POST(
        req({
          email: freshEmail(),
          answers: [
            { questionId: 0, answer: "tekir" },
            { questionId: 1, answer: "ataturk" },
            { questionId: 2, answer: "yilmaz" },
          ],
          newPassword: "YeniSifre1!",
        }),
      );

      expect(res.status).toBe(400);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("uydurma token ile şifre değiştirilemez", async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      realisticVerify();

      const res = await POST(
        req({
          email: freshEmail(),
          answers: [
            { questionId: 0, answer: "tekir" },
            { questionId: 1, answer: "ataturk" },
            { questionId: 2, answer: "yilmaz" },
          ],
          newPassword: "YeniSifre1!",
          resetToken: "a".repeat(64),
        }),
      );

      expect(res.status).toBe(400);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("geçerli token tek kullanımlıktır — ikinci kullanım reddedilir", async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      realisticVerify();
      const email = freshEmail();
      const answers = [
        { questionId: 0, answer: "tekir" },
        { questionId: 1, answer: "ataturk" },
        { questionId: 2, answer: "yilmaz" },
      ];

      const verified = await (await POST(req({ email, answers }))).json();
      const token = verified.resetToken;

      const first = await POST(
        req({ email, answers, newPassword: "YeniSifre1!", resetToken: token }),
      );
      const second = await POST(
        req({ email, answers, newPassword: "BaskaSifre1!", resetToken: token }),
      );

      expect(first.status).toBe(200);
      expect(second.status).toBe(400);
      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("şifre politikası", () => {
    async function attemptPassword(newPassword: string) {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      realisticVerify();
      const email = freshEmail();
      const answers = [
        { questionId: 0, answer: "tekir" },
        { questionId: 1, answer: "ataturk" },
        { questionId: 2, answer: "yilmaz" },
      ];

      const verified = await (await POST(req({ email, answers }))).json();
      return POST(
        req({ email, answers, newPassword, resetToken: verified.resetToken }),
      );
    }

    it.each([
      ["Kisa1!", "8 karakterden kısa"],
      ["uzunsifre1!", "büyük harfsiz"],
      ["UZUNSIFRE1!", "küçük harfsiz"],
      ["UzunSifre!!", "rakamsız"],
      ["UzunSifre11", "özel karaktersiz"],
    ])("%s reddedilir (%s)", async (password) => {
      const res = await attemptPassword(password);
      expect(res.status).toBe(400);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("politikaya uyan şifre kabul edilir ve hash'lenerek yazılır", async () => {
      const res = await attemptPassword("GucluSifre1!");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.step).toBe("success");
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: { password: "hashed-new-password" },
        }),
      );
      // Ham şifre asla yazılmaz
      expect(hashMock).toHaveBeenCalledWith("GucluSifre1!");
    });
  });

  describe("rate limit", () => {
    it("meşru 3 adımlı akış tek IP'de kilitlenmeden tamamlanır", async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      realisticVerify();
      const ip = "10.9.9.9";
      const email = freshEmail();
      const answers = [
        { questionId: 0, answer: "tekir" },
        { questionId: 1, answer: "ataturk" },
        { questionId: 2, answer: "yilmaz" },
      ];

      const step1 = await POST(req({ email }, ip));
      const step2res = await POST(req({ email, answers }, ip));
      const step2 = await step2res.json();
      const step3 = await POST(
        req({ email, answers, newPassword: "GucluSifre1!", resetToken: step2.resetToken }, ip),
      );

      expect(step1.status).toBe(200);
      expect(step2res.status).toBe(200);
      expect(step3.status).toBe(200);
    });

    it("birkaç kez yanlış hatırlayıp sonunda bilen kullanıcı kilitlenmez", async () => {
      // Eski davranışta kota HER istekte tüketiliyordu: e-posta(1) + üç yanlış
      // deneme(2,3,4) + doğru cevap(5) + yeni şifre(6) → son adımda 429.
      // Yeni davranışta yalnızca 1. adım ve yanlış denemeler sayılır (4) →
      // doğrulama ve şifre belirleme adımları kota yemez.
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      const ip = "10.7.7.7";
      const email = freshEmail();
      const correct = [
        { questionId: 0, answer: "tekir" },
        { questionId: 1, answer: "ataturk" },
        { questionId: 2, answer: "yilmaz" },
      ];
      const wrong = correct.map((a) => ({ ...a, answer: "yanlis" }));

      realisticVerify();
      await POST(req({ email }, ip)); // adım 1
      for (let i = 0; i < 3; i++) {
        await POST(req({ email, answers: wrong }, ip)); // yanlış denemeler
      }

      const verified = await (await POST(req({ email, answers: correct }, ip))).json();
      const done = await POST(
        req({ email, answers: correct, newPassword: "GucluSifre1!", resetToken: verified.resetToken }, ip),
      );

      expect(done.status).toBe(200);
    });

    it("art arda yanlış cevaplar 429'a yol açar", async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithAnswers());
      verifyMock.mockResolvedValue(false);
      const ip = "10.8.8.8";
      const answers = [
        { questionId: 0, answer: "yanlis" },
        { questionId: 1, answer: "yanlis" },
        { questionId: 2, answer: "yanlis" },
      ];

      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await POST(req({ email: freshEmail(), answers }, ip));
        statuses.push(res.status);
      }

      expect(statuses).toContain(429);
    });
  });

  it("e-posta gönderilmezse 400", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
