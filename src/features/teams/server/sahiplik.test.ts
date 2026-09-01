// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ogrencisiMi,
  mentoruMu,
  erisebilirMi,
  atamaninOgrenciIdleri,
  takimAtamasiMi,
  enDusukSeviye,
  mentorErisimiWhere,
  type SahiplikliAtama,
} from "./sahiplik";

/**
 * #332 — atama sahipliği. BU BİR YETKİ KATMANI.
 *
 * `AssignedProject.studentProfileId` nullable olduktan sonra "bu atama kimin"
 * sorusunu 15 dosya soruyordu. Hepsi buradan geçiyor; buradaki bir hata
 * dosya/yorum/adım uçlarında yetki açığı demek.
 *
 * En kritik iddia: AYRILMIŞ ÜYE SAHİP DEĞİLDİR. Üyelik satırı katkı geçmişi
 * için silinmiyor, sorguda `leftAt: null` ile filtreleniyor — bu testler
 * filtrenin sonucunu, yani "ayrılmış üye listeye girmez"i kilitliyor.
 */

const bireysel = (userId = "ogr-1", mentorlar: string[] = ["men-1"]): SahiplikliAtama => ({
  studentProfile: {
    id: "sp-1",
    userId,
    mentorAssignments: mentorlar.map((m) => ({ mentorId: m })),
  },
  team: null,
});

const takim = (
  uyeIdleri: string[] = ["ogr-1", "ogr-2"],
  mentorlar: string[] = ["men-t"],
): SahiplikliAtama => ({
  studentProfile: null,
  team: {
    id: "t-1",
    name: "Takım A",
    // ⚠️ Bu liste sorguda `leftAt: null` ile daraltılmış olarak gelir;
    // ayrılmış üye burada HİÇ bulunmaz.
    members: uyeIdleri.map((u, i) => ({
      role: ["frontend", "backend", "qa"][i % 3],
      studentProfile: { id: `sp-${u}`, userId: u },
    })),
    mentors: mentorlar.map((m) => ({ mentorId: m })),
  },
});

describe("bireysel atama — davranış DEĞİŞMEMELİ", () => {
  it("sahibi öğrencidir", () => {
    expect(ogrencisiMi(bireysel(), "ogr-1")).toBe(true);
    expect(ogrencisiMi(bireysel(), "baskasi")).toBe(false);
  });

  it("kendi mentörü erişir (#195 M:N)", () => {
    const a = bireysel("ogr-1", ["men-1", "men-2"]);
    expect(mentoruMu(a, "men-2")).toBe(true);
    expect(mentoruMu(a, "men-3")).toBe(false);
  });

  it("takım ataması değildir", () => {
    expect(takimAtamasiMi(bireysel())).toBe(false);
  });
});

describe("takım ataması", () => {
  it("TÜM aktif üyeler öğrencidir", () => {
    const a = takim(["ogr-1", "ogr-2", "ogr-3"]);
    for (const u of ["ogr-1", "ogr-2", "ogr-3"]) expect(ogrencisiMi(a, u)).toBe(true);
    expect(ogrencisiMi(a, "yabanci")).toBe(false);
  });

  it("ayrılmış üye listeye GİRMEZ", () => {
    // Sorgu `leftAt: null` ile daraltıyor; ayrılan üye üye listesinde yok.
    const a = takim(["ogr-1"]); // ogr-2 ayrılmış → listede değil
    expect(ogrencisiMi(a, "ogr-2")).toBe(false);
    expect(atamaninOgrenciIdleri(a)).toEqual(["ogr-1"]);
  });

  it("takımın mentörü erişir", () => {
    expect(mentoruMu(takim(["ogr-1"], ["men-t"]), "men-t")).toBe(true);
    expect(mentoruMu(takim(["ogr-1"], ["men-t"]), "men-x")).toBe(false);
  });

  it("takım ataması olarak tanınır", () => {
    expect(takimAtamasiMi(takim())).toBe(true);
  });
});

describe("erişim kapısı", () => {
  it("öğrenci de mentör de geçer, yabancı geçemez", () => {
    const a = takim(["ogr-1"], ["men-t"]);
    expect(erisebilirMi(a, "ogr-1")).toBe(true);
    expect(erisebilirMi(a, "men-t")).toBe(true);
    expect(erisebilirMi(a, "yabanci")).toBe(false);
  });

  it("kimliksiz istek HER ZAMAN reddedilir", () => {
    // `undefined === undefined` gibi bir kaza yetki açığı olurdu.
    for (const kimlik of [null, undefined, ""]) {
      expect(ogrencisiMi(takim(), kimlik)).toBe(false);
      expect(mentoruMu(takim(), kimlik)).toBe(false);
      expect(erisebilirMi(bireysel(), kimlik)).toBe(false);
    }
  });

  it("sahipsiz atama kimseye açılmaz", () => {
    // CHECK kısıtı bunu engelliyor ama kod da savunmasız kalmamalı.
    const bos: SahiplikliAtama = { studentProfile: null, team: null };
    expect(erisebilirMi(bos, "ogr-1")).toBe(false);
    expect(atamaninOgrenciIdleri(bos)).toEqual([]);
  });
});

describe("mentorErisimiWhere", () => {
  it("hem bireysel hem takım yolunu kapsar", () => {
    // Yalnız birini üretseydi mentör, öğrencilerinin yarısını göremezdi.
    const w = mentorErisimiWhere("men-1");
    expect(w.OR).toHaveLength(2);
    // Şeklin kendisini doğruluyoruz; Prisma tipleri iç içe erişimi daraltıyor.
    expect(JSON.stringify(w)).toContain('"mentorAssignments"');
    expect(JSON.stringify(w)).toContain('"mentors"');
    expect(JSON.stringify(w).match(/men-1/g)).toHaveLength(2);
  });
});

describe("enDusukSeviye", () => {
  it.each([
    [["ADVANCED", "BEGINNER", "INTERMEDIATE"], "BEGINNER"],
    [["ADVANCED", "INTERMEDIATE"], "INTERMEDIATE"],
    [["ADVANCED"], "ADVANCED"],
  ])("%j -> %s", (girdi, beklenen) => {
    // Pano ortak: en yeni üyenin takip edebilmesi gerekiyor.
    expect(enDusukSeviye(girdi)).toBe(beklenen);
  });

  it("boş listede BEGINNER'a düşer", () => {
    expect(enDusukSeviye([])).toBe("BEGINNER");
  });
});
