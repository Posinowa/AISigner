// #91: Kart önizlemeleri için markdown metnini düz metne indirgeyip akıllıca kısaltır.
// Kartlarda tam markdown render etmek yerine (yer dar) işaretleri soyup tek satırlık
// bir özet gösteriyoruz. Saf fonksiyonlar — birim test edilebilir.

/**
 * Yaygın markdown işaretlerini soyar ve boşlukları tek satıra indirger.
 * Amaç mükemmel bir parser değil, önizleme için "okunabilir düz metin".
 */
export function stripMarkdown(text: string): string {
  return text
    // kod blokları ve satır içi kod işaretleri
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    // başlık işaretleri (satır başındaki #'ler)
    .replace(/^#{1,6}\s+/gm, "")
    // liste işaretleri (-, *, +, 1.)
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // blockquote
    .replace(/^\s*>\s?/gm, "")
    // kalın/italik/üstü çizili
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    // linkler: [metin](url) → metin
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // görseller: ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // yatay çizgi
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, " ")
    // kalan boşlukları sadeleştir
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Metni verilen uzunlukta, mümkünse kelime sınırında keser. Yalnızca gerçekten
 * kısaltıldıysa ellipsis (…) ekler — metin zaten kısaysa olduğu gibi döner.
 */
export function smartTruncate(text: string, maxLength = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const slice = trimmed.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  // Son boşluk makul bir yerdeyse oradan kes (kelimeyi ortadan bölme).
  const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + "…";
}

/** Markdown'ı soyup önizleme uzunluğunda kısaltan kısayol. */
export function markdownPreview(text: string, maxLength = 120): string {
  return smartTruncate(stripMarkdown(text), maxLength);
}
