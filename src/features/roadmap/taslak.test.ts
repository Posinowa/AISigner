import { describe, it, expect } from "vitest";
import { taslakMi, taslakUyarisi, TASLAK_ROZETI, TASLAK_SONUCU } from "./taslak";

/**
 * #405: Taslak yol haritasının SONUCU söylenmeli.
 *
 * Metin tek kaynaktan geliyor; üç yüzey (yol haritası sayfası, mentör panosu,
 * öğrenci detayı) aynı sözcükleri kullanmalı.
 */
describe("taslakMi", () => {
  it("DRAFT taslaktır", () => {
    expect(taslakMi("DRAFT")).toBe(true);
  });

  it("PUBLISHED taslak DEĞİLDİR", () => {
    expect(taslakMi("PUBLISHED")).toBe(false);
  });

  it("yol haritası yoksa taslak da değildir", () => {
    // "Yol haritası yok" ayrı bir durum; taslak uyarısı gösterilmemeli.
    expect(taslakMi(null)).toBe(false);
    expect(taslakMi(undefined)).toBe(false);
  });

  it("bilinmeyen durum taslak sayılmaz", () => {
    // Şemaya yeni bir durum eklenirse sessizce "taslak" damgası yemesin.
    expect(taslakMi("ARCHIVED")).toBe(false);
  });
});

describe("taslakUyarisi", () => {
  it("taslak yoksa uyarı YOK — '0 taslak var' gürültüdür", () => {
    expect(taslakUyarisi(0)).toBeNull();
    expect(taslakUyarisi(-1)).toBeNull();
  });

  it("tek taslakta tekil dil kullanır", () => {
    const m = taslakUyarisi(1);
    expect(m).toContain("1 yol haritası");
    expect(m).toContain("stajyeriniz");
  });

  it("birden fazla taslakta sayıyı ve çoğul dili kullanır", () => {
    const m = taslakUyarisi(3);
    expect(m).toContain("3 yol haritası");
    expect(m).toContain("stajyerleriniz");
  });

  it("⚠️ uyarı SONUCU söyler, yalnız durumu değil", () => {
    // "Taslak" demek yetmiyordu; kaybolan şey stajyerin adımları görememesi.
    expect(taslakUyarisi(1)).toContain("göremiyor");
    expect(TASLAK_SONUCU).toContain("göremiyor");
  });

  it("rozet metni yayında olmadığını açıkça söyler", () => {
    expect(TASLAK_ROZETI).toContain("yayında değil");
  });
});
