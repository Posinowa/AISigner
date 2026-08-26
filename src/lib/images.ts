/**
 * #265: Yüklenen dosyanın gerçekten bir resim olup olmadığını içeriğinden
 * doğrular.
 *
 * Neden uzantı yetmiyor: uzantı ve istemcinin bildirdiği MIME tipi tamamen
 * saldırganın kontrolünde. `.png` uzantılı bir HTML dosyası satır içi servis
 * edilirse tarayıcı onu HTML sanabilir. Bu yüzden dosyanın İMZA BAYTLARINA
 * (magic bytes) bakıyoruz.
 *
 * SVG bilerek DESTEKLENMİYOR: metin tabanlı, içine script gömülebiliyor ve
 * bazı bağlamlarda çalışıyor. Profil fotoğrafı için gerekli de değil.
 */

export type ResimTipi = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** Desteklenen uzantılar — kullanıcıya gösterilecek liste. */
export const DESTEKLENEN_UZANTILAR = ["png", "jpg", "jpeg", "webp", "gif"] as const;

function baytlarEsitMi(buf: Buffer, offset: number, imza: number[]): boolean {
  if (buf.length < offset + imza.length) return false;
  return imza.every((b, i) => buf[offset + i] === b);
}

/**
 * İçerikten resim tipini belirler. Resim değilse `null`.
 *
 * Dönen değer, dosyanın servis edileceği `Content-Type` olarak kullanılır —
 * yani istemciden gelen hiçbir bilgiye dayanmaz.
 */
export function resimTipiniBelirle(buf: Buffer): ResimTipi | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (baytlarEsitMi(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (baytlarEsitMi(buf, 0, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  // GIF: "GIF87a" veya "GIF89a"
  if (
    baytlarEsitMi(buf, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    baytlarEsitMi(buf, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return "image/gif";
  }

  // WebP: "RIFF" .... "WEBP" — boyut alanı arada olduğu için iki parça kontrol.
  if (
    baytlarEsitMi(buf, 0, [0x52, 0x49, 0x46, 0x46]) &&
    baytlarEsitMi(buf, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }

  return null;
}

/** Tipe karşılık gelen dosya uzantısı (depolama adı için). */
export function tipeGoreUzanti(tip: ResimTipi): string {
  switch (tip) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
  }
}
