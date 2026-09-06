// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #262 — sıfırlama ucu sözleşmesi.
 *
 * En kritik davranış: hesap varlığı SIZMAMALI. Kayıtlı ve kayıtsız e-posta
 * aynı yanıtı, aynı durum kodunu almalı — oran sınırı aşıldığında bile.
 */

const { sendMock, resetMock, ipMock, hesapMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  resetMock: vi.fn(),
  ipMock: vi.fn(),
  hesapMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: (ad: string) => ({
    check: (...a: unknown[]) =>
      ad === "reset-password-ip" ? ipMock(...a) : hesapMock(...a),
  }),
}));
vi.mock("@/features/auth/server/password-reset", () => ({
  sendPasswordResetEmail: sendMock,
  resetPassword: resetMock,
}));

import { POST } from "./route";

const istek = (govde: unknown) =>
  new Request("http://t/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(govde),
  });

async function cagir(govde: unknown) {
  const r = await POST(istek(govde));
  return { durum: r.status, govde: await r.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  ipMock.mockReturnValue({ allowed: true });
  hesapMock.mockReturnValue({ allowed: true });
  sendMock.mockResolvedValue(undefined);
  resetMock.mockResolvedValue({ ok: true });
});

describe("talep adımı — hesap varlığı sızmaz", () => {
  it("kayıtlı e-posta için genel mesaj döner", async () => {
    const r = await cagir({ email: "var@ornek.com" });
    expect(r.durum).toBe(200);
    expect(r.govde.message).toMatch(/kayıtlıysa/i);
  });

  it("kayıtsız e-posta AYNI yanıtı alır", async () => {
    // Servis hesabın olmadığını bize söylemiyor; uç da ayrım yapamıyor.
    const kayitli = await cagir({ email: "var@ornek.com" });
    const kayitsiz = await cagir({ email: "yok@ornek.com" });

    expect(kayitsiz).toEqual(kayitli);
  });

  it("hesap oran sınırı aşılınca da AYNI yanıt döner", async () => {
    // 429 dönmek "bu hesap var" demenin dolaylı yolu olurdu.
    hesapMock.mockReturnValue({ allowed: false, retryAfterSeconds: 60 });

    const r = await cagir({ email: "var@ornek.com" });

    expect(r.durum).toBe(200);
    expect(r.govde.message).toMatch(/kayıtlıysa/i);
    expect(sendMock, "sınır aşıldığında e-posta gönderilmemeli").not.toHaveBeenCalled();
  });

  it("e-posta küçük harfe indirgenir", async () => {
    await cagir({ email: "  BuyuK@Ornek.COM  " });
    expect(sendMock).toHaveBeenCalledWith("buyuk@ornek.com");
  });

  it("geçersiz e-posta 400 alır", async () => {
    expect((await cagir({ email: "bu-eposta-degil" })).durum).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("IP oran sınırı", () => {
  it("aşılınca 429 ve Retry-After döner", async () => {
    ipMock.mockReturnValue({ allowed: false, retryAfterSeconds: 42 });

    const r = await POST(istek({ email: "x@ornek.com" }));

    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("42");
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("sıfırlama adımı", () => {
  it("geçerli token ve güçlü şifre kabul edilir", async () => {
    const r = await cagir({ token: "t", password: "YeniSifre1!" });

    expect(r.durum).toBe(200);
    expect(resetMock).toHaveBeenCalledWith("t", "YeniSifre1!");
  });

  it.each([
    ["kisa", "Ab1!"],
    ["buyuk harf yok", "yenisifre1!"],
    ["rakam yok", "YeniSifree!"],
    ["ozel karakter yok", "YeniSifre11"],
  ])("zayıf şifre reddedilir: %s", async (_ad, sifre) => {
    // Sıfırlama, kayıt akışındaki kuralları atlamanın yolu olmamalı.
    const r = await cagir({ token: "t", password: sifre });

    expect(r.durum).toBe(400);
    expect(resetMock, "zayıf şifre DB'ye gitmemeli").not.toHaveBeenCalled();
  });

  it("süresi geçmiş token için yenisini isteme mesajı verilir", async () => {
    resetMock.mockResolvedValue({ ok: false, reason: "expired" });

    const r = await cagir({ token: "t", password: "YeniSifre1!" });

    expect(r.durum).toBe(400);
    expect(r.govde.error).toMatch(/süresi doldu/i);
  });

  it("geçersiz token için kullanılmış olabileceği söylenir", async () => {
    resetMock.mockResolvedValue({ ok: false, reason: "invalid" });

    const r = await cagir({ token: "t", password: "YeniSifre1!" });

    expect(r.durum).toBe(400);
    expect(r.govde.error).toMatch(/geçersiz veya daha önce kullanılmış/i);
  });

  it("hata mesajı imza ayrıntısı sızdırmaz", async () => {
    resetMock.mockResolvedValue({ ok: false, reason: "invalid" });

    const r = await cagir({ token: "t", password: "YeniSifre1!" });

    expect(r.govde.error).not.toMatch(/imza|signature|hash/i);
  });
});

describe("bozuk istek", () => {
  it("JSON olmayan gövde 400 alır", async () => {
    const r = await POST(
      new Request("http://t", { method: "POST", body: "bu json degil" }),
    );
    expect(r.status).toBe(400);
  });

  it("boş gövde 400 alır", async () => {
    expect((await cagir({})).durum).toBe(400);
  });
});
