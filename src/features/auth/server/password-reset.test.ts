// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #262 — e-postayla şifre sıfırlama servisi.
 *
 * İki kritik sözleşme:
 * - hesap olsun olmasın hata fırlatmaz ve varlığını ele vermez
 * - token tek kullanımlık: şifre değişince aynı bağlantı ikinci kez çalışmaz
 */

const { prismaMock, mailMock, loggerMock, hashMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
  mailMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  hashMock: vi.fn(async (s: string) => `hashed:${s}`),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/mail", () => ({ sendMail: mailMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@node-rs/argon2", () => ({ hash: hashMock }));

import { sendPasswordResetEmail, resetPassword, buildResetUrl } from "./password-reset";
import { createResetToken } from "@/lib/auth/reset-token";

const ESKI_HASH = "argon2-eski";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-gizli";
  mailMock.mockResolvedValue({ sent: true });
  prismaMock.user.update.mockResolvedValue({});
});

describe("sendPasswordResetEmail — hesap var", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "k1",
      name: "Ayse",
      password: ESKI_HASH,
    });
  });

  it("sıfırlama bağlantısı gönderilir", async () => {
    await sendPasswordResetEmail("ayse@ornek.com");

    expect(mailMock).toHaveBeenCalledTimes(1);
    expect(mailMock.mock.calls[0][0].to).toBe("ayse@ornek.com");
  });

  it("e-postada geçerli bir sıfırlama bağlantısı bulunur", async () => {
    await sendPasswordResetEmail("ayse@ornek.com");

    const metin = mailMock.mock.calls[0][0].text as string;
    expect(metin).toContain("/reset-password?token=");
  });

  it("e-postada şifre hash'i GEÇMEZ", async () => {
    await sendPasswordResetEmail("ayse@ornek.com");
    expect(mailMock.mock.calls[0][0].text).not.toContain(ESKI_HASH);
  });
});

describe("sendPasswordResetEmail — hesap yok", () => {
  it("kayıtsız adrese e-posta GÖNDERİLMEZ", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await sendPasswordResetEmail("yok@ornek.com");

    expect(mailMock).not.toHaveBeenCalled();
  });

  it("hata FIRLATMAZ — uç her durumda aynı yanıtı verebilsin", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(sendPasswordResetEmail("yok@ornek.com")).resolves.toBeUndefined();
  });

  it("veritabanı hatası da yukarı taşınmaz", async () => {
    // Aksi halde hata mesajından hesabın varlığı okunabilirdi.
    prismaMock.user.findUnique.mockRejectedValue(new Error("db down"));

    await expect(sendPasswordResetEmail("x@ornek.com")).resolves.toBeUndefined();
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("şifresi olmayan hesaba e-posta gönderilmez", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "k1", name: "X", password: null });

    await sendPasswordResetEmail("x@ornek.com");

    expect(mailMock).not.toHaveBeenCalled();
  });
});

describe("resetPassword — geçerli token", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "k1", password: ESKI_HASH });
  });

  it("şifre değiştirilir", async () => {
    const t = createResetToken("k1", ESKI_HASH);

    expect(await resetPassword(t, "YeniSifre1!")).toEqual({ ok: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "k1" },
      data: { password: "hashed:YeniSifre1!" },
    });
  });

  it("yeni şifre düz metin saklanmaz", async () => {
    const t = createResetToken("k1", ESKI_HASH);
    await resetPassword(t, "YeniSifre1!");

    expect(hashMock).toHaveBeenCalledWith("YeniSifre1!");
    expect(prismaMock.user.update.mock.calls[0][0].data.password).not.toBe(
      "YeniSifre1!",
    );
  });
});

describe("resetPassword — TEK KULLANIMLIK", () => {
  it("şifre değiştikten sonra aynı token çalışmaz", async () => {
    const t = createResetToken("k1", ESKI_HASH);

    // İlk kullanım
    prismaMock.user.findUnique.mockResolvedValue({ id: "k1", password: ESKI_HASH });
    expect(await resetPassword(t, "YeniSifre1!")).toEqual({ ok: true });

    // Şifre değişti → hash değişti → aynı bağlantı ölü
    prismaMock.user.findUnique.mockResolvedValue({
      id: "k1",
      password: "hashed:YeniSifre1!",
    });
    expect(await resetPassword(t, "BaskaSifre1!")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("ikinci denemede şifre GÜNCELLENMEZ", async () => {
    const t = createResetToken("k1", ESKI_HASH);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "k1",
      password: "artik-baska-hash",
    });

    await resetPassword(t, "BaskaSifre1!");

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("resetPassword — geçersiz durumlar", () => {
  it("bozuk token reddedilir, DB'ye gidilmez", async () => {
    expect(await resetPassword("bozuk", "YeniSifre1!")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("kullanıcı yoksa geçersiz döner", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const t = createResetToken("k1", ESKI_HASH);

    expect(await resetPassword(t, "YeniSifre1!")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("süresi geçmiş token AYRI bildirilir", async () => {
    // Kullanıcı yenisini isteyebilsin diye bu ayrım korunuyor.
    prismaMock.user.findUnique.mockResolvedValue({ id: "k1", password: ESKI_HASH });
    const t = createResetToken("k1", ESKI_HASH, 1000);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5000);
    const sonuc = await resetPassword(t, "YeniSifre1!");
    vi.useRealTimers();

    expect(sonuc).toEqual({ ok: false, reason: "expired" });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("BAŞKA kullanıcının tokenıyla şifre değiştirilemez", async () => {
    const t = createResetToken("kurban", ESKI_HASH);
    const [, sure, imza] = t.split(".");
    prismaMock.user.findUnique.mockResolvedValue({ id: "k1", password: ESKI_HASH });

    const sonuc = await resetPassword(`k1.${sure}.${imza}`, "YeniSifre1!");

    expect(sonuc.ok).toBe(false);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("buildResetUrl", () => {
  it("token url-encode edilir", () => {
    expect(buildResetUrl("a b/c")).toContain("token=a%20b%2Fc");
  });
});
