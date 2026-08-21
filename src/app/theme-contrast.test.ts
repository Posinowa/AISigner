import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * #237 — marka paleti kontrast sözleşmesi.
 *
 * Renkler CSS'te yaşadığı için birim testiyle değil, stil dosyasını okuyup
 * kontrastı hesaplayarak korunuyor. Biri "biraz daha koyu olsun" diye değer
 * değiştirirse ve AA'nın altına düşerse burada yakalanır.
 *
 * #245 ile koyu tema kaldırıldı; bu testler tek (açık) tema için geçerli.
 */

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf-8");
const kod = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** @theme bloğundaki bir tokenın değerini okur. */
function token(ad: string): string {
  const eslesme = kod.match(/@theme\s*\{/);
  if (!eslesme) throw new Error("@theme bloğu bulunamadı");
  const bas = eslesme.index!;
  const govde = kod.slice(bas, kod.indexOf("}", bas));
  const m = govde.match(new RegExp(`--color-${ad}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`@theme bloğunda --color-${ad} bulunamadı`);
  return m[1].toLowerCase();
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function parlaklik(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function oran(a: string, b: string): number {
  const [x, y] = [parlaklik(a), parlaklik(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const AA = 4.5;

describe("Marka paleti — açık tema (#237)", () => {
  it("primary üzerinde primary-foreground okunur", () => {
    expect(oran(token("primary"), token("primary-foreground")))
      .toBeGreaterThanOrEqual(AA);
  });

  it("primary, zemine karşı metin olarak okunur (bağlantı rengi)", () => {
    expect(oran(token("primary"), token("background")))
      .toBeGreaterThanOrEqual(AA);
  });

  it("accent üzerinde accent-foreground okunur", () => {
    expect(oran(token("accent"), token("accent-foreground")))
      .toBeGreaterThanOrEqual(AA);
  });

  it("primary marka laciverti olarak kalır", () => {
    expect(token("primary")).toBe("#23356c");
  });
});

describe("Anlamsal renkler korunur (#237)", () => {
  it("destructive kırmızı ailesinde kalır", () => {
    const d = token("destructive");
    const h = d.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    expect(r, "kırmızı bileşen baskın olmalı").toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it("destructive üzerinde yazı okunur", () => {
    expect(
      oran(token("destructive"), token("destructive-foreground")),
    ).toBeGreaterThanOrEqual(AA);
  });
});
