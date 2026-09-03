// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * #376 — SQL sahiplik parçaları.
 *
 * ⚠️ BU TESTLER SQL'İ KANITLAMAZ. Üretilen metnin doğru tabloları ve
 * koşulları içerdiğini kilitliyorlar, o kadar. Sorguların gerçekten doğru
 * sonuç verdiği, GERÇEK Postgres'e ekilmiş bilinen değerlerle ayrıca
 * doğrulandı (#331'in kuralı) — PR açıklamasında ölçümler var.
 *
 * Buradaki değer şu: kural iki dilde yaşamak zorunda (Prisma + ham SQL) ve
 * bu testler SQL kopyasının takım dalını KAYBETMEDİĞİNİ kilitliyor.
 */


import { mentorunAtamasiSql, mentorunOgrencisiSql, atamaOgrencininSql } from "./sahiplik-sql";
import { Prisma } from "@prisma/client";

/** Prisma.Sql'in ürettiği ham metin — parametreler $1, $2… olarak görünür. */
const metin = (s: Prisma.Sql) => s.sql.replace(/\s+/g, " ");

describe("mentorunAtamasiSql", () => {
  const s = metin(mentorunAtamasiSql("men-1"));

  it("BİREYSEL bağı sorar", () => {
    expect(s).toContain('"MentorAssignment"');
    expect(s).toContain('ma."studentProfileId" = ap."studentProfileId"');
  });

  it("TAKIM bağını da sorar — #332 sonrası eksik kalan dal", () => {
    expect(s).toContain('"TeamMentor"');
    expect(s).toContain('tm."teamId" = ap."teamId"');
  });

  it("mentör verilmezse kapsam daraltılmaz (admin görünümü)", () => {
    expect(s).toContain("IS NULL");
  });
});

describe("mentorunOgrencisiSql", () => {
  const s = metin(mentorunOgrencisiSql("men-1"));

  it("bireysel VE takım bağını birlikte sorar", () => {
    expect(s).toContain('"MentorAssignment"');
    expect(s).toContain('"TeamMember"');
    expect(s).toContain('"TeamMentor"');
  });

  it("AYRILMIŞ üyeyi dışlar", () => {
    expect(s).toContain('tmb."leftAt" IS NULL');
  });
});

describe("atamaOgrencininSql", () => {
  const s = metin(atamaOgrencininSql("ap2", Prisma.sql`o."profilId"`));

  it("verilen takma adı kullanır", () => {
    expect(s).toContain('"ap2"."studentProfileId"');
    expect(s).toContain('"ap2"."teamId"');
  });

  it("TAKIM üyeliği üzerinden de eşleşir — studentProfileId takımda NULL", () => {
    expect(s).toContain('"TeamMember"');
  });

  it("AYRILMIŞ üyeyi dışlar", () => {
    expect(s).toContain('tmb."leftAt" IS NULL');
  });

  it("profil sütunu çağırandan gelir", () => {
    expect(s).toContain('o."profilId"');
  });
});

describe("takma ad doğrulaması — `Prisma.raw` kapısı", () => {
  /*
   * `Prisma.raw` PARAMETRELEŞTİRMEZ: verdiğin metin sorguya olduğu gibi
   * girer. `atamaOgrencininSql`'in takma ad parametresi bugün yalnız kod içi
   * sabitlerden besleniyor, yani sömürülebilir bir yol YOK — ama imza
   * `string` ve `Prisma.raw`'a giden tek doğrulanmamış girdi buydu.
   *
   * Testin işi bu kapıyı KİLİTLEMEK: yarın biri buraya kullanıcı verisinden
   * türeyen bir değer geçirdiğinde sessizce çalışmasın.
   */
  it("meşru takma adlar kabul edilir", () => {
    expect(() => atamaOgrencininSql("ap", Prisma.sql`x`)).not.toThrow();
    expect(() => atamaOgrencininSql("ap2", Prisma.sql`x`)).not.toThrow();
    expect(() => atamaOgrencininSql("_a_1", Prisma.sql`x`)).not.toThrow();
  });

  it("⚠️ tırnak kaçışı REDDEDİLİR — enjeksiyonun asıl yolu", () => {
    // `"` kapatıp kendi SQL'ini yazmak: kalıbın engellediği şey tam bu.
    expect(() => atamaOgrencininSql('ap" OR "1"="1', Prisma.sql`x`)).toThrow(
      /Geçersiz SQL takma adı/,
    );
  });

  it("boşluk, noktalı virgül ve yorum işareti reddedilir", () => {
    for (const kotu of ["ap ", "ap;DROP TABLE x", "ap--", "ap/*", "a b"]) {
      expect(() => atamaOgrencininSql(kotu, Prisma.sql`x`)).toThrow();
    }
  });

  it("boş ad ve rakamla başlayan ad reddedilir", () => {
    expect(() => atamaOgrencininSql("", Prisma.sql`x`)).toThrow();
    expect(() => atamaOgrencininSql("1ap", Prisma.sql`x`)).toThrow();
  });

  it("SESSİZCE KIRPMAZ, fırlatır", () => {
    // Kırpmak sorgunun YANLIŞ satırları eşlemesine yol açardı; patlaması yeğ.
    try {
      atamaOgrencininSql("ap; --", Prisma.sql`x`);
      expect.unreachable("fırlatmalıydı");
    } catch (e) {
      expect((e as Error).message).toContain("Geçersiz SQL takma adı");
    }
  });
});
