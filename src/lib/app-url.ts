/**
 * Uygulamanın taban adresi — TEK KAYNAK (#392).
 *
 * ⚠️ NEDEN VAR: `NEXT_PUBLIC_APP_URL` yedi ayrı yerde okunuyordu ve ÜÇ FARKLI
 * varsayılana düşüyordu:
 *
 *   certificate.ts        → https://posinowa.com
 *   paylasim.ts, layout,
 *   robots, sitemap       → https://aisigner.com
 *   e-posta doğrulama,
 *   şifre sıfırlama       → http://localhost:3000
 *
 * Sonucu görünür bir tutarsızlıktı: sertifikanın QR/doğrulama bağlantısı bir
 * alan adına, LinkedIn paylaşım bağlantısı BAŞKA bir alan adına gidiyordu.
 * Daha kötüsü, e-posta doğrulama bağlantısı üretimde `localhost` gösterebilirdi.
 *
 * ⚠️ ÜRETİMDE SESSİZ VARSAYIM YOK — bu hatayı üreten şey tam olarak oydu.
 * Değişken tanımsızsa **hata fırlatılır**. Sertifika QR'ı basılıp paylaşıldıktan
 * sonra geri alınamaz: yanlış alan adı taşıyan belgeler dolaşımda kalır.
 * Gürültülü başarısızlık, sessiz yanlışlıktan iyidir.
 *
 * Geliştirmede `http://localhost:3000`'e düşülür — orada yanlış bir alan adı
 * varsayma riski yok ve her geliştiricinin değişken tanımlamasını beklemek
 * gereksiz sürtünme olurdu.
 */

const GELISTIRME_VARSAYILANI = "http://localhost:3000";

/** Sondaki eğik çizgileri temizler: `${url}/yol` iki eğik çizgi üretmesin. */
function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function uygulamaUrl(): string {
  const ham = process.env.NEXT_PUBLIC_APP_URL;

  if (ham && ham.trim()) return normalize(ham);

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL tanımlı değil. Sertifika doğrulama bağlantıları, " +
        "e-posta doğrulama ve şifre sıfırlama linkleri bu adrese dayanıyor; " +
        "yanlış bir alan adı varsaymak yerine başlatma durduruluyor.",
    );
  }

  return GELISTIRME_VARSAYILANI;
}
