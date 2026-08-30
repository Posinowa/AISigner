import { describe, it, expect } from "vitest";
import { sinirla, ALAN_SINIRI } from "./truncate";

describe("sinirla", () => {
  it("sınırın altındaki metne DOKUNMAZ", () => {
    // Normal durum: AI çıktısının çoğu sınırın altında, hiçbir şey değişmemeli.
    const metin = "kısa bir issue gövdesi";
    expect(sinirla(metin, 100)).toBe(metin);
  });

  it("tam sınırdaki metne dokunmaz", () => {
    const metin = "x".repeat(50);
    expect(sinirla(metin, 50)).toBe(metin);
  });

  it("sınırı aşan metni sınıra İNDİRİR (işaret dahil)", () => {
    // Kritik: sonuç sınırı aşarsa Postgres yine "right truncated" fırlatırdı.
    const sonuc = sinirla("x".repeat(5000), ALAN_SINIRI.issueBody);
    expect(sonuc.length).toBeLessThanOrEqual(ALAN_SINIRI.issueBody);
  });

  it("kesildiğini AÇIKÇA işaretler", () => {
    // Sessiz kesme, okuyucunun eksik metni tam sanmasına yol açar.
    expect(sinirla("x".repeat(5000), 100)).toContain("kısaltıldı");
  });

  it("metnin BAŞINI korur (sonunu değil)", () => {
    const sonuc = sinirla("BAŞLANGIÇ" + "x".repeat(5000), 200);
    expect(sonuc.startsWith("BAŞLANGIÇ")).toBe(true);
  });

  it("işaretten kısa sınırlarda bile taşmaz", () => {
    // Uç durum: sınır işaretin kendisinden kısa.
    expect(sinirla("x".repeat(100), 10).length).toBeLessThanOrEqual(10);
  });
});
