// @vitest-environment node
import { describe, it, expect } from "vitest";

/**
 * Mentör panosu proje sayaçları (#393).
 *
 * ⚠️ Hata: takımı olup bireysel projesi olmayan stajyer "0 aktif proje"
 * sayılıyor, mentöre yanlış "aktif projesi yok" uyarısı gidiyordu. Takım
 * atamasında `AssignedProject.studentProfileId` NULL (#332).
 *
 * Bu, #367/#370/#376'da düzeltilen körlüğün DÖRDÜNCÜ örneği — ve ilki
 * sorguda değil SAYIMDA.
 */

import {
  ogrencininProjeleri,
  aktifProjeSayisi,
  tamamlananProjeSayisi,
  benzersizProjeSayisi,
  type SayilabilirOgrenci,
} from "./proje-sayaci";

const proje = (id: string, status = "IN_PROGRESS") => ({ id, status });

const ogrenci = (
  bireysel: ReturnType<typeof proje>[] = [],
  takimProjeleri: ReturnType<typeof proje>[][] = [],
): SayilabilirOgrenci => ({
  studentProfile: {
    assignedProjects: bireysel,
    teamMemberships: takimProjeleri.map((ps) => ({ team: { assignedProjects: ps } })),
  },
});

describe("öğrenci başına sayım", () => {
  it("bireysel projeler sayılır", () => {
    expect(aktifProjeSayisi(ogrenci([proje("a")]))).toBe(1);
  });

  it("⚠️ SADECE TAKIM projesi olan stajyer 0 SAYILMAZ — asıl hata buydu", () => {
    const o = ogrenci([], [[proje("t1")]]);

    expect(aktifProjeSayisi(o)).toBe(1);
    // Mentöre "aktif projesi yok" uyarısı bu sayıya bakıyor.
    expect(aktifProjeSayisi(o)).not.toBe(0);
  });

  it("bireysel + takım birlikte sayılır", () => {
    expect(aktifProjeSayisi(ogrenci([proje("a")], [[proje("t1")]]))).toBe(2);
  });

  it("tamamlanan projeler ayrı sayılır", () => {
    const o = ogrenci([proje("a", "COMPLETED")], [[proje("t1")]]);

    expect(aktifProjeSayisi(o)).toBe(1);
    expect(tamamlananProjeSayisi(o)).toBe(1);
  });

  it("aynı proje iki yoldan gelirse BİR kez sayılır", () => {
    expect(aktifProjeSayisi(ogrenci([proje("ayni")], [[proje("ayni")]]))).toBe(1);
  });

  it("profili olmayan kullanıcı çökertmez", () => {
    expect(aktifProjeSayisi({ studentProfile: null })).toBe(0);
    expect(ogrencininProjeleri({})).toEqual([]);
  });

  it("takım üyeliği olmayan eski kayıtlarda çalışır", () => {
    expect(aktifProjeSayisi({ studentProfile: { assignedProjects: [proje("a")] } })).toBe(1);
  });
});

describe("panel toplamları", () => {
  it("⚠️ TAKIM PROJESİ BİR KEZ sayılır — üç üye üç proje DEĞİL", () => {
    // Aynı takım projesi üç üyede de görünüyor. Öğrenci başına toplarsak
    // panel gerçekte olmayan bir iş hacmi gösterir.
    const uyeler = [
      ogrenci([], [[proje("takim-1")]]),
      ogrenci([], [[proje("takim-1")]]),
      ogrenci([], [[proje("takim-1")]]),
    ];

    expect(benzersizProjeSayisi(uyeler, true)).toBe(1);
  });

  it("öğrenci KARTINDAKİ sayı yine 1 — proje gerçekten onun", () => {
    // Toplamda tekilleştirmek, kişisel sayıyı düşürmemeli.
    const uye = ogrenci([], [[proje("takim-1")]]);
    expect(aktifProjeSayisi(uye)).toBe(1);
  });

  it("bireysel projeler öğrenci başına ayrı sayılır", () => {
    const liste = [ogrenci([proje("a")]), ogrenci([proje("b")])];
    expect(benzersizProjeSayisi(liste, true)).toBe(2);
  });

  it("tamamlanan toplamı ayrı hesaplanır", () => {
    const liste = [
      ogrenci([proje("a", "COMPLETED")], [[proje("t1")]]),
      ogrenci([], [[proje("t1")]]),
    ];

    expect(benzersizProjeSayisi(liste, false)).toBe(1);
    expect(benzersizProjeSayisi(liste, true)).toBe(1);
  });

  it("boş listede 0", () => {
    expect(benzersizProjeSayisi([], true)).toBe(0);
  });
});
