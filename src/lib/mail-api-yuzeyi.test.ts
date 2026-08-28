// @vitest-environment node
import { describe, it, expect } from "vitest";
import nodemailer from "nodemailer";

/**
 * #124: nodemailer'ın GERÇEK API yüzeyi.
 *
 * `mail.test.ts` nodemailer'ı tamamen sahteliyor (`vi.mock("nodemailer")`) —
 * bu doğru, çünkü orada test edilen bizim mantığımız. Ama sahteleme bir kör
 * nokta bırakıyor: nodemailer'ın ANA SÜRÜM atlaması kullandığımız yüzeyi
 * kırsa hiçbir test kırmızıya dönmezdi.
 *
 * Bu dosya o boşluğu kapatıyor: gerçek modülü içe aktarıp yalnızca
 * `lib/mail.ts`'in dayandığı üç şeyi doğruluyor.
 *
 * Ağa ÇIKMAZ: `createTransport` tembeldir, bağlantı ilk gönderimde kurulur.
 * Burada hiç `sendMail` çağrılmıyor.
 */

describe("nodemailer — dayandığımız API yüzeyi", () => {
  it("createTransport bir fonksiyon", () => {
    expect(typeof nodemailer.createTransport).toBe("function");
  });

  it("kendi yapılandırma şeklimizle taşıyıcı üretir", () => {
    // `readMailConfig`in döndürdüğü şekil.
    const t = nodemailer.createTransport({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "kullanici", pass: "parola" },
    });

    try {
      expect(typeof t.sendMail).toBe("function");
    } finally {
      // Havuzu açık bırakma; test süreci asılı kalmasın.
      t.close();
    }
  });

  it("secure=true (465) yapılandırması da kabul edilir", () => {
    const t = nodemailer.createTransport({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: { user: "kullanici", pass: "parola" },
    });

    try {
      expect(typeof t.sendMail).toBe("function");
    } finally {
      t.close();
    }
  });
});
