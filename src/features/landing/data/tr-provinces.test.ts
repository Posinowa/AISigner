import { describe, it, expect } from "vitest";
import {
  PROVINCES,
  SEED_PROVINCES,
  FLIPPED_LABELS,
  MAP_VIEWBOX,
} from "./tr-provinces";

/**
 * Bu veri üretilmiş bir dosyadan geliyor (bkz. dosya başlığı). Testler,
 * yeniden üretim veya elle düzenleme sırasında sessizce bozulabilecek
 * varsayımları koruyor.
 */
describe("tr-provinces — harita verisi bütünlüğü", () => {
  it("tam 81 il içerir", () => {
    expect(PROVINCES).toHaveLength(81);
  });

  it("il adları benzersizdir", () => {
    const adlar = PROVINCES.map((p) => p.name);
    expect(new Set(adlar).size).toBe(adlar.length);
  });

  it("Türkçe karakterli adlar bozulmamıştır", () => {
    const adlar = PROVINCES.map((p) => p.name);
    // Latinleştirme sırasında en sık bozulan iller
    expect(adlar).toContain("İstanbul");
    expect(adlar).toContain("İzmir");
    expect(adlar).toContain("Diyarbakır");
    expect(adlar).toContain("Şanlıurfa");
    expect(adlar).toContain("Kahramanmaraş");
    expect(adlar).toContain("Kırıkkale");
    expect(adlar).toContain("Muğla");
    expect(adlar).toContain("Ağrı");

    // Latinleştirilmiş biçimleri KALMAMALI
    expect(adlar).not.toContain("Istanbul");
    expect(adlar).not.toContain("Diyarbakir");
    expect(adlar).not.toContain("K. Maras");
    expect(adlar).not.toContain("Kinkkale");
  });

  it("her ilin geçerli bir SVG path verisi vardır", () => {
    for (const p of PROVINCES) {
      expect(p.d.startsWith("M"), `${p.name} M ile başlamalı`).toBe(true);
      expect(p.d.endsWith("Z"), `${p.name} Z ile bitmeli`).toBe(true);
      // yalnızca M/L/Z komutları ve sayılar — beklenmedik komut sızmasın
      expect(p.d, `${p.name} beklenmeyen komut içeriyor`).toMatch(
        /^[MLZ0-9,.\-]+$/,
      );
    }
  });

  it("ağırlık merkezleri viewBox içindedir", () => {
    for (const p of PROVINCES) {
      expect(p.cx, `${p.name} cx`).toBeGreaterThanOrEqual(0);
      expect(p.cx, `${p.name} cx`).toBeLessThanOrEqual(MAP_VIEWBOX.width);
      expect(p.cy, `${p.name} cy`).toBeGreaterThanOrEqual(0);
      expect(p.cy, `${p.name} cy`).toBeLessThanOrEqual(MAP_VIEWBOX.height);
    }
  });

  it("path koordinatları viewBox sınırlarını aşmaz", () => {
    for (const p of PROVINCES) {
      const sayilar = p.d.match(/-?\d+(\.\d+)?/g) ?? [];
      for (let i = 0; i < sayilar.length; i += 2) {
        const x = Number(sayilar[i]);
        const y = Number(sayilar[i + 1]);
        expect(x, `${p.name} x taşması`).toBeGreaterThanOrEqual(-1);
        expect(x, `${p.name} x taşması`).toBeLessThanOrEqual(
          MAP_VIEWBOX.width + 1,
        );
        if (!Number.isNaN(y)) {
          expect(y, `${p.name} y taşması`).toBeGreaterThanOrEqual(-1);
          expect(y, `${p.name} y taşması`).toBeLessThanOrEqual(
            MAP_VIEWBOX.height + 1,
          );
        }
      }
    }
  });
});

describe("tr-provinces — animasyon yapılandırması", () => {
  it("seed illerinin tamamı veri içinde bulunur", () => {
    const adlar = new Set(PROVINCES.map((p) => p.name));
    for (const seed of SEED_PROVINCES) {
      expect(adlar.has(seed), `${seed} veri içinde yok`).toBe(true);
    }
  });

  it("animasyon Ankara'dan başlar", () => {
    expect(SEED_PROVINCES[0]).toBe("Ankara");
  });

  it("seed listesi benzersizdir", () => {
    expect(new Set(SEED_PROVINCES).size).toBe(SEED_PROVINCES.length);
  });

  it("etiketi çevrilen iller seed listesinin alt kümesidir", () => {
    // Pin yalnızca seed illerde çizilir; seed olmayan bir ilin etiketini
    // çevirmek sessizce etkisiz kalır.
    for (const ad of FLIPPED_LABELS) {
      expect(
        (SEED_PROVINCES as readonly string[]).includes(ad),
        `${ad} seed değil ama etiketi çevrilmiş`,
      ).toBe(true);
    }
  });

  it("etiketi çevrilen iller haritanın sağ yarısındadır", () => {
    // Sol yarıdaki bir ilin etiketini sola çevirmek onu haritadan taşırır.
    for (const ad of FLIPPED_LABELS) {
      const il = PROVINCES.find((p) => p.name === ad);
      expect(il, `${ad} bulunamadı`).toBeDefined();
      expect(il!.cx, `${ad} sol yarıda`).toBeGreaterThan(
        MAP_VIEWBOX.width / 2,
      );
    }
  });
});
