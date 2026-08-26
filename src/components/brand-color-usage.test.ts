import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * #239 — marka rengi kullanım sözleşmesi.
 *
 * Renkler bileşenlere sabit kodlandığı için (token sistemi uzun süre
 * kullanılmadı) kaymalar sessizce geri geliyor. Bu testler iki değişmezi
 * koruyor. Renk *değerlerini* değil, *kullanım biçimini* denetler.
 */

function tsxDosyalari(kok: string): string[] {
  const cikti: string[] = [];
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) cikti.push(...tsxDosyalari(yol));
    else if (ad.endsWith(".tsx") && !ad.includes(".test.")) cikti.push(yol);
  }
  return cikti;
}

const dosyalar = tsxDosyalari(join(process.cwd(), "src"));
const icerik = dosyalar.map((y) => ({ yol: y, kod: readFileSync(y, "utf-8") }));

/** className içinde birlikte geçen sınıfları yakalar. */
function ihlaller(desen: RegExp): string[] {
  const bulunan: string[] = [];
  for (const { yol, kod } of icerik) {
    for (const m of kod.matchAll(desen)) {
      bulunan.push(`${yol.split("src")[1]}: ${m[0].slice(0, 70)}`);
    }
  }
  return bulunan;
}

describe("Marka rengi kullanımı (#239)", () => {
  it("bg-primary üzerinde sabit text-white kullanılmaz", () => {
    /*
      Koyu temada primary logonun orta mavisi (#3e92cc). Beyaz yazı o ton
      üzerinde 3.39 kontrast verir — AA'nın altında. Yazı rengi de tokendan
      gelmeli: text-primary-foreground.
    */
    expect(ihlaller(/bg-primary[^"'`]*\btext-white\b/g)).toEqual([]);
  });

  /*
    NOT: Odak halkası (`focus:ring-*`) koruması bilerek EKLENMEDİ. Auth
    ekranlarındaki iki odak halkası #238'de dönüştürülüyor; o merge edilmeden
    buraya konulan test, başka bir PR'ın dosyaları yüzünden kırmızı olurdu.
    #238 indikten sonra ayrı bir PR ile eklenecek.

    Süsleme/kategori halkaları (StepComments renk şeması, RoadmapSteps aktif
    kart vurgusu) kapsam dışı — onlar odak göstergesi değil.
  */
});
