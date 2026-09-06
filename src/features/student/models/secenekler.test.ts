import { describe, it, expect } from "vitest";
import {
  ILGI_ALANLARI,
  ilgiEtiketi,
  DENEYIM_SEVIYELERI,
  GIT_SEVIYELERI,
  DOGUM_YILI_EN_ERKEN,
  dogumYiliEnGec,
} from "./secenekler";

/**
 * #289 — başvuru seçeneklerinin sözleşmesi.
 *
 * En kırılgan nokta ESKİ KAYITLAR: liste değişse de kayıtlı profiller
 * eski değerleri taşımaya devam ediyor. Gösterim bunları ham hâlde
 * bırakırsa admin panelinde "Web Development" gibi çiğ değerler görünür.
 */

describe("ilgi alanları", () => {
  it("değerler benzersiz", () => {
    const degerler = ILGI_ALANLARI.map((i) => i.deger);
    expect(new Set(degerler).size).toBe(degerler.length);
  });

  it("platformun kendi iş akışını kapsar", () => {
    // Her şey GitHub üzerinden yürürken DevOps seçeneği yoktu; asıl boşluk buydu.
    const degerler = ILGI_ALANLARI.map((i) => i.deger);
    expect(degerler).toContain("DevOps");
    expect(degerler).toContain("Backend");
  });

  it("ESKİ kayıtlardaki değer ham gösterilmez", () => {
    expect(ilgiEtiketi("Web Development")).toBe("Web Geliştirme");
  });

  it("tanınmayan değer kaybolmaz, ham döner", () => {
    // Veri kaybetmektense bilinmeyeni göstermek yeğdir.
    expect(ilgiEtiketi("Quantum")).toBe("Quantum");
  });

  it("güncel değerler kendi etiketlerini verir", () => {
    expect(ilgiEtiketi("AI")).toBe("Yapay Zeka & ML");
  });
});

describe("deneyim seviyeleri", () => {
  it("kanonik değerler KORUNUR — AI ve mentör arayüzü bu sözlüğü paylaşıyor", () => {
    expect(DENEYIM_SEVIYELERI.map((s) => s.deger)).toEqual([
      "beginner",
      "intermediate",
      "advanced",
    ]);
  });

  it("en üst kova gerçek takım deneyimini ölçer", () => {
    // Eski tanım "kendi çapımda proje yaptım" idi; bu aslında orta seviye.
    const ileri = DENEYIM_SEVIYELERI.at(-1)!;
    expect(ileri.aciklama).toMatch(/review/i);
    expect(DENEYIM_SEVIYELERI[1].aciklama).toMatch(/uçtan uca/i);
  });
});

describe("git seviyeleri", () => {
  it("hiç kullanmamıştan PR açmaya kadar uzanır", () => {
    expect(GIT_SEVIYELERI.map((s) => s.deger)).toEqual([
      "none",
      "basic",
      "branching",
      "pr",
    ]);
  });
});

describe("doğum yılı sınırları", () => {
  it("üst sınır SABİT değil — her yıl kayar", () => {
    // Formun içindeki eski şema max(2015) diyordu; sabit yıl bayatlıyordu.
    expect(dogumYiliEnGec()).toBe(new Date().getFullYear() - 15);
  });

  it("aralık mantıklı", () => {
    expect(DOGUM_YILI_EN_ERKEN).toBeLessThan(dogumYiliEnGec());
  });
});
