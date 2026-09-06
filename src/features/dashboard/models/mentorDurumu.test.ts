import { describe, it, expect } from "vitest";
import { mentorDurumu, OGRENCILER_CAPASI } from "./mentorDurumu";

/**
 * #290 — mentör karşılamasının "sırada ne var" sözleşmesi.
 *
 * Kritik nokta ÖNCELİK: profili eksik öğrenciye iyi proje atanamaz, bu yüzden
 * eksik profil projesizlikten ÖNCE gelmeli. İkisi de doğruyken yanlış olanı
 * göstermek mentörü boşa yönlendirir.
 */

const temel = { ogrenciSayisi: 0, profiliEksikSayisi: 0, projesizSayisi: 0 };

describe("mentorDurumu — öncelik", () => {
  it("eksik profil, projesizlikten ÖNCE gelir", () => {
    const sonuc = mentorDurumu({
      ogrenciSayisi: 5,
      profiliEksikSayisi: 2,
      projesizSayisi: 4,
    });

    expect(sonuc.siradaki?.etiket).toContain("profili eksik");
    expect(sonuc.siradaki?.etiket).not.toContain("proje bekliyor");
  });

  it("profiller tamamsa projesizliğe geçer", () => {
    const sonuc = mentorDurumu({
      ogrenciSayisi: 5,
      profiliEksikSayisi: 0,
      projesizSayisi: 3,
    });

    expect(sonuc.siradaki?.etiket).toContain("3 öğrenci proje bekliyor");
    expect(sonuc.siradaki?.href).toBe(OGRENCILER_CAPASI);
  });
});

describe("mentorDurumu — öğrencisi olmayan mentör", () => {
  it("bekleme boş geçmesin diye şablon hazırlamaya yönlendirir", () => {
    // Eşleştirmeyi mentör yapamıyor; ama hazır şablon atama gelince işe yarar.
    const sonuc = mentorDurumu(temel);

    expect(sonuc.durum).toContain("atanmadı");
    expect(sonuc.siradaki?.href).toContain("/projects");
  });

  it("öğrencisi yokken öğrenci listesine yönlendirmez", () => {
    expect(mentorDurumu(temel).siradaki?.href).not.toBe(OGRENCILER_CAPASI);
  });
});

describe("mentorDurumu — her şey yolunda", () => {
  it("bekleyen iş yokken eylem UYDURULMAZ", () => {
    const sonuc = mentorDurumu({
      ogrenciSayisi: 4,
      profiliEksikSayisi: 0,
      projesizSayisi: 0,
    });

    expect(sonuc.siradaki).toBeNull();
    expect(sonuc.durum).toContain("4");
  });
});
