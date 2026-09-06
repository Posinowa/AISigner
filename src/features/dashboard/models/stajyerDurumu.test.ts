import { describe, it, expect } from "vitest";
import { stajyerDurumu, PROJELER_CAPASI } from "./stajyerDurumu";

/**
 * #290 — karşılama ekranının "sırada ne var" sözleşmesi.
 *
 * En kritik nokta ÖNCELİK: aynı anda birden fazla durum doğru olabilir
 * (mezun + projesi var + mentörü var). Kullanıcıya tek bir sıradaki iş
 * gösterilmeli, o da doğru olanı.
 *
 * İkinci kritik nokta: kullanıcının yapabileceği bir şey YOKKEN eylem
 * göstermemek. Boş vaat, hiç vaat vermemekten kötüdür.
 */

const temel = {
  mezun: false,
  projeSayisi: 0,
  mentorSayisi: 0,
  siradakiAdim: null,
};

describe("stajyerDurumu — öncelik", () => {
  it("mezuniyet her şeyin ÖNÜNDE gelir", () => {
    const sonuc = stajyerDurumu({
      ...temel,
      mezun: true,
      projeSayisi: 3,
      mentorSayisi: 1,
      siradakiAdim: { baslik: "Adım", projeAdi: "Proje" },
    });

    expect(sonuc.durum).toContain("arşiv");
    expect(sonuc.siradaki).toBeNull();
  });

  it("elde iş varken BEKLEME mesajı gösterilmez", () => {
    const sonuc = stajyerDurumu({
      ...temel,
      projeSayisi: 1,
      mentorSayisi: 1,
      siradakiAdim: { baslik: "Repoyu klonla", projeAdi: "Blog API" },
    });

    expect(sonuc.siradaki?.etiket).toBe("Repoyu klonla");
    expect(sonuc.durum).not.toContain("hazırlıyor");
  });
});

describe("stajyerDurumu — eylemi olmayan durumlar", () => {
  it("mentör YOKKEN eylem gösterilmez", () => {
    // Eşleştirmeyi stajyer hızlandıramaz; buton koymak boş vaat olurdu.
    const sonuc = stajyerDurumu(temel);

    expect(sonuc.siradaki).toBeNull();
    expect(sonuc.durum).toContain("inceleniyor");
  });

  it("mezun stajyere sıradaki iş uydurulmaz", () => {
    expect(stajyerDurumu({ ...temel, mezun: true }).siradaki).toBeNull();
  });
});

describe("stajyerDurumu — eylemi olan durumlar", () => {
  it("sıradaki adım, projeler bölümüne götürür", () => {
    const sonuc = stajyerDurumu({
      ...temel,
      projeSayisi: 1,
      siradakiAdim: { baslik: "Testleri yaz", projeAdi: "Blog API" },
    });

    expect(sonuc.siradaki?.href).toBe(PROJELER_CAPASI);
    expect(sonuc.siradaki?.aciklama).toContain("Blog API");
  });

  it("adımların hepsi bitmişse mentöre haber vermeye yönlendirir", () => {
    const sonuc = stajyerDurumu({ ...temel, projeSayisi: 2, mentorSayisi: 1 });

    expect(sonuc.siradaki?.href).toContain("/messages");
    expect(sonuc.durum).toContain("tamamladın");
  });

  it("mentör atanmış ama proje yoksa tanışmaya yönlendirir", () => {
    const sonuc = stajyerDurumu({ ...temel, mentorSayisi: 1 });

    expect(sonuc.siradaki?.href).toContain("/messages");
    expect(sonuc.durum).toContain("hazırlıyor");
  });
});

/**
 * #416: Odak kartı varken karşılamadaki "SIRADA" bağlantısı bastırılır.
 *
 * Aynı adımı iki yerde göstermek, biri güncellenip diğeri unutulduğunda
 * ayrışırdı; üstelik kart eylemleri de taşıdığı için bağlantı daha azını
 * sunuyor.
 */
describe("stajyerDurumu — odak kartıyla çakışma (#416)", () => {
  const girdi = {
    mezun: false,
    projeSayisi: 1,
    mentorSayisi: 1,
    siradakiAdim: { baslik: "Faz 2", projeAdi: "Portföy" },
  };

  it("kart YOKKEN bağlantı gösterilir (mevcut davranış)", () => {
    const s = stajyerDurumu(girdi);
    expect(s.siradaki?.etiket).toBe("Faz 2");
  });

  it("⚠️ kart VARKEN bağlantı bastırılır", () => {
    const s = stajyerDurumu({ ...girdi, siradakiAdimKartta: true });
    expect(s.siradaki).toBeNull();
  });

  it("durum cümlesi her iki durumda da aynı kalır", () => {
    expect(stajyerDurumu(girdi).durum).toBe("Çalışma masan hazır.");
    expect(stajyerDurumu({ ...girdi, siradakiAdimKartta: true }).durum).toBe(
      "Çalışma masan hazır.",
    );
  });

  it("adım yokken bayrak bir şeyi değiştirmez", () => {
    const s = stajyerDurumu({ ...girdi, siradakiAdim: null, siradakiAdimKartta: true });
    expect(s.durum).toBe("Atanan adımların hepsini tamamladın.");
    expect(s.siradaki?.etiket).toBe("Mentörüne haber ver");
  });
});
