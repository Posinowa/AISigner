import { describe, it, expect } from "vitest";
import { stripMarkdown, smartTruncate, markdownPreview } from "./markdown-preview";

describe("stripMarkdown (#91)", () => {
  it("başlık işaretlerini soyar", () => {
    expect(stripMarkdown("## Proje Açıklaması")).toBe("Proje Açıklaması");
    expect(stripMarkdown("### Öğrenme Hedefleri")).toBe("Öğrenme Hedefleri");
  });

  it("liste işaretlerini soyar ve tek satıra indirger", () => {
    expect(stripMarkdown("- HTML\n- CSS\n- JS")).toBe("HTML CSS JS");
    expect(stripMarkdown("1. İlk\n2. İkinci")).toBe("İlk İkinci");
  });

  it("kalın/italik/kod işaretlerini soyar", () => {
    expect(stripMarkdown("**kalın** ve *italik* ve `kod`")).toBe("kalın ve italik ve kod");
  });

  it("linkleri metne indirger", () => {
    expect(stripMarkdown("[GitHub](https://github.com) linki")).toBe("GitHub linki");
  });

  it("gerçek seed açıklamasını okunabilir düz metne çevirir", () => {
    const md = "## Proje Açıklaması\nResponsive site.\n\n### Öğrenme Hedefleri\n- HTML5\n- CSS3";
    const result = stripMarkdown(md);
    expect(result).not.toContain("#");
    expect(result).not.toContain("-");
    expect(result).toContain("Proje Açıklaması");
    expect(result).toContain("HTML5");
  });
});

describe("smartTruncate (#91)", () => {
  it("kısa metne ellipsis EKLEMEZ", () => {
    expect(smartTruncate("Kısa metin", 120)).toBe("Kısa metin");
  });

  it("uzun metni kısaltıp ellipsis ekler", () => {
    const long = "a".repeat(200);
    const result = smartTruncate(long, 120);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(121);
  });

  it("mümkünse kelime sınırında keser (kelimeyi ortadan bölmez)", () => {
    const text = "bir iki üç dört beş altı yedi sekiz dokuz on onbir oniki";
    const result = smartTruncate(text, 20);
    expect(result.endsWith("…")).toBe(true);
    // Son karakterlerin ortasında yarım kelime kalmamalı → ellipsis'ten önce boşluk yok
    expect(result.slice(0, -1)).not.toMatch(/\s$/);
    // Kesme noktası bir kelimenin tamamı olmalı
    expect(text.startsWith(result.slice(0, -1))).toBe(true);
  });

  it("tam sınır uzunluğunda metne ellipsis eklemez", () => {
    expect(smartTruncate("x".repeat(120), 120)).toBe("x".repeat(120));
  });
});

describe("markdownPreview (#91)", () => {
  it("markdown'ı soyup kısaltır", () => {
    const md = "## Başlık\n" + "kelime ".repeat(50);
    const result = markdownPreview(md, 40);
    expect(result).not.toContain("#");
    expect(result.endsWith("…")).toBe(true);
  });

  it("kısa markdown → ellipsis yok", () => {
    expect(markdownPreview("## Kısa", 120)).toBe("Kısa");
  });
});
