import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf-8");

/**
 * Yorumları ayıkla. Aksi halde bir açıklama metninde geçen ".dark" kelimesi
 * seçici sanılıp kendisinden sonraki bloğu yanlışlıkla eşleştirir.
 */
const cssKod = css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * #landing-tek-tema koruması.
 *
 * Açılış sayfası bilerek tek temalıdır: kullanıcının teması koyu olsa bile
 * açık görünmelidir. Bu kural CSS'te yaşadığı için birim testiyle değil,
 * stil dosyasını okuyarak korunuyor — birisi "tutarlılık olsun" diye
 * `.dark` altına landing override'ı eklerse burada yakalanır.
 */
describe("Açılış sayfası teması (#landing-tek-tema)", () => {
  it(".landing bloğu tanımlıdır", () => {
    expect(css).toMatch(/^\.landing\s*\{/m);
  });

  it(".landing kendi zeminini ve metin rengini açıkça boyar", () => {
    const blok = css.slice(css.indexOf(".landing {"));
    const govde = blok.slice(0, blok.indexOf("}"));
    expect(govde).toMatch(/background:\s*var\(--landing-paper\)/);
    expect(govde).toMatch(/color:\s*var\(--landing-ink\)/);
    expect(govde).toMatch(/color-scheme:\s*light/);
  });

  it("hiçbir --landing-* tokenı .dark altında yeniden tanımlanmaz", () => {
    // .dark ile başlayan blokların gövdelerini topla
    const ihlaller: string[] = [];
    const kalip = /\.dark[^{]*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = kalip.exec(cssKod)) !== null) {
      const govde = m[1];
      const bulunan = govde.match(/--landing-[a-z0-9-]+\s*:/g);
      if (bulunan) ihlaller.push(...bulunan);
    }
    expect(ihlaller).toEqual([]);
  });

  it("teal ve mid renkleri metin için kullanılmamalı — değerleri sabit kalır", () => {
    // Kontrast hesabı bu iki değere bağlı (teal 2.5, mid 3.4 — metin için yetersiz).
    // Değer değişirse MIGRATION.md K2 tablosu da güncellenmeli.
    expect(css).toMatch(/--landing-teal:\s*#42b597/i);
    expect(css).toMatch(/--landing-mid:\s*#3e92cc/i);
  });

  it("navy ve ink değerleri kontrast tablosuyla uyumludur", () => {
    expect(css).toMatch(/--landing-navy:\s*#23356c/i);
    expect(css).toMatch(/--landing-ink:\s*#141f3d/i);
    expect(css).toMatch(/--landing-paper:\s*#f8f9fc/i);
  });
});
