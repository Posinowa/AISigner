import { describe, it, expect } from "vitest";
import { sayacDurumu, formGonderilebilir } from "./sayac";
import { ONERI_SINIRLARI, createProposalSchema } from "@/lib/validations/api";

/**
 * #408 — Asgari karakter sınırı ancak gönderince öğreniliyordu.
 *
 * Form `maxLength` uyguluyordu ama asgariyi hiçbir yerde söylemiyordu; stajyer
 * kısa yazıp gönderiyor, hata alıyordu.
 */
describe("sayacDurumu", () => {
  it("eşiğin altında yeterli değil ve eşiği söyler", () => {
    const d = sayacDurumu("kısa", 30);
    expect(d.yeterliMi).toBe(false);
    expect(d.metin).toBe("4 / en az 30 karakter");
  });

  it("eşikte yeterli sayılır", () => {
    expect(sayacDurumu("a".repeat(30), 30).yeterliMi).toBe(true);
  });

  it("yeterli olduktan sonra eşik tekrarlanmaz — gürültü olurdu", () => {
    expect(sayacDurumu("a".repeat(45), 30).metin).toBe("45 karakter");
  });

  /*
   * ⚠️ ÖLÇÜLDÜ: `z.string().min(30).transform(v => v.trim())` sırasında 35
   * BOŞLUK `min(30)`'u geçiyor ve BOŞ STRING kaydediliyordu. Şema
   * `.trim().min(30)` sırasına alındı; sayaç da kırpılmış uzunluğu saymalı,
   * yoksa arayüz "yeterli" derken sunucu reddederdi.
   */
  it("⚠️ KIRPILMIŞ uzunluk sayılır — boşlukla doldurmak yeterli değil", () => {
    expect(sayacDurumu(" ".repeat(35), 30).yeterliMi).toBe(false);
    expect(sayacDurumu(" ".repeat(35), 30).uzunluk).toBe(0);
  });

  it("baştaki/sondaki boşluk sayıyı şişirmez", () => {
    expect(sayacDurumu("   " + "a".repeat(30) + "   ", 30).uzunluk).toBe(30);
  });
});

describe("formGonderilebilir", () => {
  const gecerli = {
    title: "a".repeat(ONERI_SINIRLARI.baslik.enAz),
    description: "a".repeat(ONERI_SINIRLARI.aciklama.enAz),
    goals: "a".repeat(ONERI_SINIRLARI.hedefler.enAz),
  };

  it("üçü de yeterliyse gönderilebilir", () => {
    expect(formGonderilebilir(gecerli)).toBe(true);
  });

  it("başlık kısaysa gönderilemez", () => {
    expect(formGonderilebilir({ ...gecerli, title: "kısa" })).toBe(false);
  });

  it("açıklama kısaysa gönderilemez", () => {
    expect(formGonderilebilir({ ...gecerli, description: "kısa" })).toBe(false);
  });

  it("hedefler kısaysa gönderilemez", () => {
    expect(formGonderilebilir({ ...gecerli, goals: "kısa" })).toBe(false);
  });

  it("boş formda gönderilemez", () => {
    expect(formGonderilebilir({ title: "", description: "", goals: "" })).toBe(false);
  });

  /*
   * ⚠️ Eşikler ŞEMADAN geliyor; elle yazılan bir sayı, şema değişince
   * sessizce ayrışırdı.
   */
  it("⚠️ eşikler ŞEMA ile aynı", () => {
    const birEksik = {
      title: "a".repeat(ONERI_SINIRLARI.baslik.enAz - 1),
      description: "a".repeat(ONERI_SINIRLARI.aciklama.enAz),
      goals: "a".repeat(ONERI_SINIRLARI.hedefler.enAz),
    };
    expect(formGonderilebilir(birEksik)).toBe(false);
  });
});

/**
 * ⚠️ ŞEMA SIRASI — ölçülmüş bir hata.
 *
 * Öncesi `z.string().min(30).transform(v => v.trim())` idi: 35 BOŞLUK
 * `min(30)`'u geçiyor ve BOŞ STRING olarak kaydediliyordu. Zod'da `.trim()`
 * zincirin başında olduğunda kırpılmış uzunluk doğrulanıyor.
 */
describe("createProposalSchema — trim sırası (#408)", () => {
  const gecerli = {
    title: "Portföy Sitesi",
    description: "a".repeat(40),
    goals: "a".repeat(25),
    technologies: ["React"],
    kaynak: "BIZIM" as const,
  };

  it("⚠️ yalnız BOŞLUKTAN oluşan açıklama REDDEDİLİR", () => {
    const r = createProposalSchema.safeParse({ ...gecerli, description: " ".repeat(35) });
    expect(r.success).toBe(false);
  });

  it("⚠️ yalnız BOŞLUKTAN oluşan hedefler REDDEDİLİR", () => {
    const r = createProposalSchema.safeParse({ ...gecerli, goals: " ".repeat(25) });
    expect(r.success).toBe(false);
  });

  it("⚠️ yalnız BOŞLUKTAN oluşan başlık REDDEDİLİR", () => {
    const r = createProposalSchema.safeParse({ ...gecerli, title: " ".repeat(10) });
    expect(r.success).toBe(false);
  });

  it("boşlukla çevrili GEÇERLİ metin kabul edilir ve kırpılır", () => {
    const r = createProposalSchema.safeParse({
      ...gecerli,
      description: "  " + "a".repeat(30) + "  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBe("a".repeat(30));
  });

  it("eşiğin bir altı reddedilir", () => {
    const r = createProposalSchema.safeParse({ ...gecerli, description: "a".repeat(29) });
    expect(r.success).toBe(false);
  });
});
