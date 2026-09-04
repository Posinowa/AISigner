import { describe, it, expect } from "vitest";
import {
  ilerlemeHesapla,
  sonHareket,
  sessizGun,
  durakladiMi,
  duraklamaMetni,
  ozetle,
  ilerlemeOzetten,
  sessizGunOzetten,
  durakladiMiOzetten,
  duraklamaMetniOzetten,
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

/**
 * #452 — Kural ÖZET üzerinde tanımlı; dizi sürümleri ince sarmalayıcı.
 *
 * Bu blok bir performans testi DEĞİL, EŞDEĞERLİK testi. Toplama SQL'e
 * taşınırken asıl risk hızın değil, kuralın ikiye ayrılmasıydı: özet yolu
 * ile dizi yolu farklı cevap verirse admin ile mentör aynı atamaya farklı
 * yüzde gösterirdi — #432'nin baştan engellemek için var olduğu hata.
 * Aşağıdaki testler iki yolu AYNI girdiyle karşılaştırıyor.
 */
describe("#452 — özet yolu ile dizi yolu aynı sonucu verir", () => {
  const senaryolar: { ad: string; adimlar: { status: string; updatedAt: Date }[] }[] = [
    { ad: "hiç adım yok", adimlar: [] },
    { ad: "hepsi tamamlanmış", adimlar: [adim("COMPLETED", 40), adim("COMPLETED", 39)] },
    { ad: "kısmen tamamlanmış ve sessiz", adimlar: [adim("COMPLETED", 30), adim("TODO", 30)] },
    { ad: "yeni hareket görmüş", adimlar: [adim("COMPLETED", 30), adim("IN_PROGRESS", 0)] },
    {
      ad: "revizyon istenmiş (#379 — tamamlanmış sayılmaz)",
      adimlar: [adim("COMPLETED", 20), adim("REVISION_REQUESTED", 20)],
    },
    { ad: "yuvarlama gereken oran", adimlar: [adim("COMPLETED", 5), adim("TODO", 5), adim("TODO", 5)] },
  ];

  for (const { ad: senaryo, adimlar } of senaryolar) {
    it(senaryo, () => {
      const ozet = ozetle(adimlar);
      expect(ilerlemeOzetten(ozet)).toEqual(ilerlemeHesapla(adimlar));
      expect(sessizGunOzetten(ozet, SIMDI)).toBe(sessizGun(adimlar, SIMDI));
      expect(durakladiMiOzetten(ozet, SIMDI)).toBe(durakladiMi(adimlar, SIMDI));
      expect(duraklamaMetniOzetten(ozet, SIMDI)).toBe(duraklamaMetni(adimlar, SIMDI));
    });
  }
});

describe("#452 — ozetle", () => {
  it("SQL'in üretebileceği üç sayıya indirger", () => {
    expect(ozetle([adim("COMPLETED", 3), adim("TODO", 1), adim("TODO", 9)])).toEqual({
      toplamAdim: 3,
      tamamlanan: 1,
      sonHareketAt: gunOnce(1),
    });
  });

  it("adım yoksa son hareket null — 'adım yok' ile 'hiç ilerlemedi' ayrı (#432)", () => {
    expect(ozetle([])).toEqual({ toplamAdim: 0, tamamlanan: 0, sonHareketAt: null });
  });
});

describe("#452 — özet doğrudan SQL'den geldiğinde", () => {
  it("dizi hiç kurulmadan yüzde hesaplanır", () => {
    // SQL'den dönen satırın karşılığı: COUNT, COUNT FILTER, MAX(updatedAt).
    expect(ilerlemeOzetten({ toplamAdim: 8, tamamlanan: 3, sonHareketAt: gunOnce(2) }).yuzde).toBe(38);
  });

  it("⚠️ %100 duraklamış sayılmaz — sinyal SQL'den gelse de kural aynı", () => {
    const ozet = { toplamAdim: 4, tamamlanan: 4, sonHareketAt: gunOnce(SESSIZLIK_GUN + 60) };
    expect(durakladiMiOzetten(ozet, SIMDI)).toBe(false);
    expect(duraklamaMetniOzetten(ozet, SIMDI)).toBeNull();
  });

  it("eşiği geçen sessizlik metne dönüşür", () => {
    const ozet = { toplamAdim: 4, tamamlanan: 1, sonHareketAt: gunOnce(SESSIZLIK_GUN) };
    expect(duraklamaMetniOzetten(ozet, SIMDI)).toBe(`${SESSIZLIK_GUN} gündür hareket yok`);
  });

  it("adımsız özet duraklamış değil", () => {
    expect(durakladiMiOzetten({ toplamAdim: 0, tamamlanan: 0, sonHareketAt: null }, SIMDI)).toBe(false);
  });
});
