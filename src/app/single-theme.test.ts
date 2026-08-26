import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * #245 — tek tema sözleşmesi.
 *
 * Koyu tema kaldırıldı. Bu tür bir kaldırma sessizce geri sızar: biri yeni bir
 * bileşen yazarken alışkanlıkla `dark:` ekler, kimse fark etmez ve yarım bir
 * koyu tema oluşur — hiçbir yerde tam çalışmayan, her yerde bakım isteyen bir
 * durum. Bu testler o sızmayı yakalar.
 */

function kaynakDosyalari(kok: string): string[] {
  const cikti: string[] = [];
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) cikti.push(...kaynakDosyalari(yol));
    else if (/\.tsx?$/.test(ad) && !ad.includes(".test.")) cikti.push(yol);
  }
  return cikti;
}

const src = join(process.cwd(), "src");
const dosyalar = kaynakDosyalari(src);
const css = readFileSync(join(src, "app/globals.css"), "utf-8");
const cssKod = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Tek tema sözleşmesi (#245)", () => {
  it("hiçbir dosyada dark: varyantı kullanılmaz", () => {
    const ihlaller: string[] = [];
    for (const yol of dosyalar) {
      const kod = readFileSync(yol, "utf-8");
      for (const m of kod.matchAll(/dark:[^\s"'`]+/g)) {
        ihlaller.push(`${yol.split("src")[1]}: ${m[0]}`);
      }
    }
    expect(ihlaller).toEqual([]);
  });

  it("globals.css'te .dark bloğu veya dark varyantı tanımı kalmaz", () => {
    expect(cssKod).not.toMatch(/^\.dark\s*\{/m);
    expect(cssKod).not.toMatch(/@custom-variant\s+dark/);
    expect(cssKod).not.toMatch(/html\.dark/);
  });

  it("tema değiştirici bileşeni bulunmaz", () => {
    expect(existsSync(join(src, "components/ThemeToggle.tsx"))).toBe(false);

    const kullanan = dosyalar.filter((y) =>
      readFileSync(y, "utf-8").includes("ThemeToggle"),
    );
    expect(kullanan).toEqual([]);
  });

  it("tema seçimini localStorage'dan okuyan betik kalmaz", () => {
    const layout = readFileSync(join(src, "app/layout.tsx"), "utf-8");
    expect(layout).not.toContain("localStorage");
    expect(layout).not.toContain("prefers-color-scheme");
  });

  it("kök color-scheme açık olarak sabitlenmiştir", () => {
    // Tarayıcının form kontrollerini/kaydırma çubuğunu koyu boyamasını önler:
    // sistem tercihi koyu olan kullanıcıda arayüz tutarsız görünmesin.
    expect(cssKod).toMatch(/html\s*\{[^}]*color-scheme:\s*light/);
  });
});
