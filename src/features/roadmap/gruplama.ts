/**
 * Tamamlanan adımların katlanması (#417).
 *
 * Ölçüm (canlı, 1280×900): açık adım kartı ~300px, kilitli adım 116px,
 * tamamlanmış adım ise açık adımla AYNI boyutta. Yani kilitli adımlar için
 * sıkıştırma zaten vardı, tamamlananlar için yoktu. 10 adımlı bir yol
 * haritasında 6 tamamlanmış adım ≈ 1800px gereksiz yükseklik.
 *
 * Saf modül: veri çekmiyor, React bilmiyor.
 */

export type GruplanabilirAdim = { id: string; status: string };

export type AdimGrubu<T> =
  | { tip: "adim"; adim: T; indeks: number }
  /** Ardışık tamamlanmış adımlar — tek satıra iner. */
  | { tip: "tamamlanmis"; adimlar: T[]; indeksler: number[]; anahtar: string };

/**
 * Ardışık tamamlanmış adımları tek gruba toplar.
 *
 * ⚠️ ARDIŞIK RUN'LAR halinde gruplanıyor, "tüm tamamlananlar" olarak değil.
 * Adımlar genelde sırayla bitiyor ama zorunlu değil: bir adım revizyona
 * düşerken sonraki tamamlanmış olabilir. Hepsini tek yere toplamak zaman
 * çizgisini bozardı — hangi işin nerede bittiği kaybolurdu.
 *
 * ⚠️ REVIZYON İSTENEN ADIM ASLA GRUBA GİRMEZ: `REVISION_REQUESTED`
 * tamamlanmış değil ve tam da görülmesi gereken şey (#379).
 *
 * Orijinal indeksler korunuyor: kilit kuralı (`odak.ts`) adımın YOL
 * HARİTASINDAKİ yerine bakıyor, gruplanmış listedeki yerine değil.
 */
export function adimlariGrupla<T extends GruplanabilirAdim>(adimlar: T[]): AdimGrubu<T>[] {
  const gruplar: AdimGrubu<T>[] = [];

  for (let i = 0; i < adimlar.length; i++) {
    if (adimlar[i].status !== "COMPLETED") {
      gruplar.push({ tip: "adim", adim: adimlar[i], indeks: i });
      continue;
    }

    const basla = i;
    while (i + 1 < adimlar.length && adimlar[i + 1].status === "COMPLETED") i++;

    gruplar.push({
      tip: "tamamlanmis",
      adimlar: adimlar.slice(basla, i + 1),
      indeksler: Array.from({ length: i - basla + 1 }, (_, k) => basla + k),
      // Anahtar ilk adımın kimliğinden: liste değişince React grubu
      // karıştırmasın.
      anahtar: `tamamlanmis-${adimlar[basla].id}`,
    });
  }

  return gruplar;
}
