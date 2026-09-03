import { describe, it, expect } from "vitest";
import {
  ilerlemeHesapla,
  sonHareket,
  sessizGun,
  durakladiMi,
  duraklamaMetni,
} from "./ilerleme";
import { SESSIZLIK_GUN } from "@/features/analytics/sabitler";

/**
 * #432 — İlerleme ve duraklama, admin ile mentör arasında TEK kaynaktan.
 *
 * Hesap `assignment-progress.ts` içinde gömülüydü ve mentör panosunda hiç
 * yoktu; ikinci bir kopya yazmak bu kod tabanında dört kez yaşanmış hata
 * sınıfını tekrarlamak olurdu (#367/#370/#376/#393).
 */
const SIMDI = new Date("2026-09-20T12:00:00.000Z");
const gunOnce = (g: number) => new Date(SIMDI.getTime() - g * 86_400_000);

const adim = (status: string, gun = 0) => ({ status, updatedAt: gunOnce(gun) });

describe("ilerlemeHesapla", () => {
  it("tamamlanan oranını yüzdeye çevirir", () => {
    const i = ilerlemeHesapla([adim("COMPLETED"), adim("COMPLETED"), adim("TODO"), adim("TODO")]);
    expect(i).toEqual({ toplamAdim: 4, tamamlanan: 2, yuzde: 50 });
  });

  it("yüzde YUVARLANIR", () => {
    expect(ilerlemeHesapla([adim("COMPLETED"), adim("TODO"), adim("TODO")]).yuzde).toBe(33);
  });

  it("adım yoksa sıfıra bölme yok", () => {
    expect(ilerlemeHesapla([])).toEqual({ toplamAdim: 0, tamamlanan: 0, yuzde: 0 });
  });

  it("yalnız COMPLETED sayılır — revizyon tamamlanmış değildir (#379)", () => {
    const i = ilerlemeHesapla([adim("COMPLETED"), adim("REVISION_REQUESTED"), adim("IN_PROGRESS")]);
    expect(i.tamamlanan).toBe(1);
  });
});

describe("sonHareket / sessizGun", () => {
  it("EN YENİ adımın zamanını bulur — sıra önemli değil", () => {
    const s = sonHareket([adim("TODO", 9), adim("COMPLETED", 2), adim("TODO", 30)]);
    expect(s?.toISOString()).toBe(gunOnce(2).toISOString());
  });

  it("geçen tam günü verir", () => {
    expect(sessizGun([adim("TODO", 12)], SIMDI)).toBe(12);
  });

  it("adım yoksa null", () => {
    expect(sonHareket([])).toBeNull();
    expect(sessizGun([], SIMDI)).toBeNull();
  });

  it("geçersiz tarih listeyi bozmaz", () => {
    const s = sonHareket([{ status: "TODO", updatedAt: "gecersiz" }, adim("TODO", 3)]);
    expect(s?.toISOString()).toBe(gunOnce(3).toISOString());
  });
});

describe("durakladiMi", () => {
  it(`eşiğin (${SESSIZLIK_GUN} gün) altında duraklamış DEĞİL`, () => {
    expect(durakladiMi([adim("IN_PROGRESS", SESSIZLIK_GUN - 1)], SIMDI)).toBe(false);
  });

  it("eşikte duraklamış sayılır", () => {
    expect(durakladiMi([adim("IN_PROGRESS", SESSIZLIK_GUN)], SIMDI)).toBe(true);
  });

  /*
   * ⚠️ Bitmiş bir projede hareket olmaması NORMAL. Mezun stajyerin
   * portfolyosu (#208) aksi halde baştan sona "duraklamış" görünürdü.
   */
  it("⚠️ TAMAMLANMIŞ iş duraklamış sayılmaz", () => {
    expect(durakladiMi([adim("COMPLETED", 400), adim("COMPLETED", 400)], SIMDI)).toBe(false);
  });

  /*
   * ⚠️ Adım yoksa sorun duraklama değil; yol haritası yok ya da
   * yayınlanmamış (#405) — o farklı bir uyarı.
   */
  it("⚠️ HİÇ adım yoksa duraklamış değil", () => {
    expect(durakladiMi([], SIMDI)).toBe(false);
  });

  it("kısmen tamamlanmış ama sessiz iş duraklamıştır", () => {
    expect(
      durakladiMi([adim("COMPLETED", 30), adim("IN_PROGRESS", 30)], SIMDI),
    ).toBe(true);
  });
});

describe("duraklamaMetni", () => {
  /*
   * ⚠️ SKOR DEĞİL SİNYAL (#331/#397). Metin verinin kendisi; "%73 risk" gibi
   * uydurma bir kesinlik üretilmiyor.
   */
  it("⚠️ metin GÜN sayısını söyler, skor üretmez", () => {
    const m = duraklamaMetni([adim("IN_PROGRESS", 14)], SIMDI);
    expect(m).toBe("14 gündür hareket yok");
    expect(m).not.toMatch(/%|risk|skor/i);
  });

  it("duraklamamışsa null", () => {
    expect(duraklamaMetni([adim("IN_PROGRESS", 1)], SIMDI)).toBeNull();
  });
});
