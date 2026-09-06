import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createResetToken, verifyResetToken, parseResetToken } from "./reset-token";

/**
 * #262 — sıfırlama tokenı güvenlik sözleşmesi.
 *
 * Token DB'de saklanmadığı için tüm güvence imzada. En kritik özellik TEK
 * KULLANIMLIK olması: imza kullanıcının o anki şifre hash'ine bağlı, şifre
 * değişince token ölüyor.
 */

const ORJINAL = process.env.AUTH_SECRET;
const HASH = "argon2-hash-eski";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-gizli-anahtar";
});

afterEach(() => {
  process.env.AUTH_SECRET = ORJINAL;
  vi.useRealTimers();
});

describe("createResetToken", () => {
  it("üç parçalı token üretir", () => {
    expect(createResetToken("k1", HASH).split(".")).toHaveLength(3);
  });

  it("AUTH_SECRET yoksa hata fırlatır", () => {
    delete process.env.AUTH_SECRET;
    expect(() => createResetToken("k1", HASH)).toThrow(/AUTH_SECRET/);
  });

  it("şifre hash'i tokenın İÇİNDE taşınmaz", () => {
    // Token ele geçse bile hash sızmamalı.
    const t = createResetToken("k1", HASH);
    expect(t).not.toContain(HASH);
  });
});

describe("verifyResetToken — geçerli", () => {
  it("aynı hash ile doğrulanır", () => {
    const t = createResetToken("k1", HASH);
    expect(verifyResetToken(t, HASH)).toEqual({ valid: true, userId: "k1" });
  });
});

describe("verifyResetToken — TEK KULLANIMLIK", () => {
  it("şifre değişince token GEÇERSİZ olur", () => {
    // Asıl güvence bu: sıfırlama yapıldıktan sonra hash değişir ve aynı
    // bağlantı ikinci kez kullanılamaz.
    const t = createResetToken("k1", HASH);
    expect(verifyResetToken(t, "argon2-hash-YENI")).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("kullanıcı şifresini başka yolla değiştirse de token ölür", () => {
    const t = createResetToken("k1", HASH);
    expect(verifyResetToken(t, "kullanicinin-elle-degistirdigi-hash").valid).toBe(
      false,
    );
  });
});

describe("verifyResetToken — kurcalama", () => {
  it("imza değiştirilirse reddedilir", () => {
    const t = createResetToken("k1", HASH);
    const [id, sure] = t.split(".");
    expect(verifyResetToken(`${id}.${sure}.sahteimza`, HASH)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("BAŞKA kullanıcıya uygulanamaz", () => {
    // En kritik senaryo: kendi tokenını alıp başkasının şifresini sıfırlamak.
    const t = createResetToken("k1", HASH);
    const [, sure, imza] = t.split(".");
    expect(verifyResetToken(`kurban-2.${sure}.${imza}`, HASH).valid).toBe(false);
  });

  it("süre uzatılamaz", () => {
    const t = createResetToken("k1", HASH);
    const [id, , imza] = t.split(".");
    expect(
      verifyResetToken(`${id}.${Date.now() + 10 ** 10}.${imza}`, HASH),
    ).toEqual({ valid: false, reason: "bad-signature" });
  });

  it("farklı AUTH_SECRET ile üretilen token kabul edilmez", () => {
    const t = createResetToken("k1", HASH);
    process.env.AUTH_SECRET = "baska-anahtar";
    expect(verifyResetToken(t, HASH)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });
});

describe("verifyResetToken — biçim ve süre", () => {
  it.each(["", "tekparca", "iki.parca", "a.b.c.d"])(
    "bozuk biçim reddedilir: %s",
    (bozuk) => {
      expect(verifyResetToken(bozuk, HASH)).toEqual({
        valid: false,
        reason: "malformed",
      });
    },
  );

  it("sayı olmayan süre reddedilir", () => {
    expect(verifyResetToken("id.sure-degil.imza", HASH)).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("süresi geçmiş token reddedilir", () => {
    const t = createResetToken("k1", HASH, 1000);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5000);
    expect(verifyResetToken(t, HASH)).toEqual({ valid: false, reason: "expired" });
  });

  it("süresi dolmamış token kabul edilir", () => {
    expect(verifyResetToken(createResetToken("k1", HASH, 60_000), HASH).valid).toBe(
      true,
    );
  });

  it("geçersiz imzada süre nedeni SIZMAZ", () => {
    // Süre kontrolü imzadan sonra: saldırgan süreyi öğrenemesin.
    const t = createResetToken("k1", HASH, 1000);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5000);
    const sonuc = verifyResetToken(t, "baska-hash");
    expect(sonuc.valid).toBe(false);
    expect(sonuc.valid === false && sonuc.reason).toBe("bad-signature");
  });
});

describe("parseResetToken", () => {
  it("imza doğrulamadan kullanıcı kimliğini verir", () => {
    // Çağıran taraf hash'i çekebilmek için önce kimliğe ihtiyaç duyuyor.
    const t = createResetToken("k1", HASH);
    const c = parseResetToken(t);
    expect(c.ok && c.userId).toBe("k1");
  });

  it("bozuk tokende ok:false döner", () => {
    expect(parseResetToken("bozuk").ok).toBe(false);
  });
});
