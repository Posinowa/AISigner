import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createVerificationToken,
  verifyVerificationToken,
} from "./verification-token";

/**
 * #247 — doğrulama tokenı güvenlik sözleşmesi.
 *
 * Token DB'de saklanmadığı için tüm güvence imzada. Bu testler kurcalamanın
 * her biçimini kapsıyor: imza değişimi, kullanıcı değişimi, süre uzatma.
 */

const ORJINAL = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = "test-gizli-anahtar";
});

afterEach(() => {
  process.env.AUTH_SECRET = ORJINAL;
  vi.useRealTimers();
});

describe("createVerificationToken", () => {
  it("üç parçalı token üretir", () => {
    expect(createVerificationToken("kullanici-1").split(".")).toHaveLength(3);
  });

  it("AUTH_SECRET yoksa hata fırlatır", () => {
    delete process.env.AUTH_SECRET;
    expect(() => createVerificationToken("kullanici-1")).toThrow(/AUTH_SECRET/);
  });
});

describe("verifyVerificationToken — geçerli token", () => {
  it("kullanıcı kimliğini geri verir", () => {
    const t = createVerificationToken("kullanici-1");
    expect(verifyVerificationToken(t)).toEqual({
      valid: true,
      userId: "kullanici-1",
    });
  });
});

describe("verifyVerificationToken — kurcalama", () => {
  it("imza değiştirilirse reddedilir", () => {
    const t = createVerificationToken("kullanici-1");
    const [id, sure] = t.split(".");
    const sahte = `${id}.${sure}.sahteimza`;
    expect(verifyVerificationToken(sahte)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("BAŞKA kullanıcıya uygulanamaz", () => {
    // En kritik senaryo: kendi tokenını alıp başkasının hesabını doğrulamak.
    const t = createVerificationToken("kullanici-1");
    const [, sure, imza] = t.split(".");
    const sahte = `kurban-2.${sure}.${imza}`;
    expect(verifyVerificationToken(sahte).valid).toBe(false);
  });

  it("süre uzatılamaz", () => {
    const t = createVerificationToken("kullanici-1");
    const [id, , imza] = t.split(".");
    const uzatilmis = `${id}.${Date.now() + 10 ** 10}.${imza}`;
    expect(verifyVerificationToken(uzatilmis)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("farklı AUTH_SECRET ile üretilen token kabul edilmez", () => {
    const t = createVerificationToken("kullanici-1");
    process.env.AUTH_SECRET = "baska-anahtar";
    expect(verifyVerificationToken(t)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });
});

describe("verifyVerificationToken — biçim ve süre", () => {
  it.each(["", "tekparca", "iki.parca", "a.b.c.d"])(
    "bozuk biçim reddedilir: %s",
    (bozuk) => {
      expect(verifyVerificationToken(bozuk)).toEqual({
        valid: false,
        reason: "malformed",
      });
    },
  );

  it("sayı olmayan süre reddedilir", () => {
    expect(verifyVerificationToken("id.sure-degil.imza")).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("süresi geçmiş token reddedilir", () => {
    const t = createVerificationToken("kullanici-1", 1000);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5000);
    expect(verifyVerificationToken(t)).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("süresi dolmamış token kabul edilir", () => {
    const t = createVerificationToken("kullanici-1", 60_000);
    expect(verifyVerificationToken(t).valid).toBe(true);
  });
});
