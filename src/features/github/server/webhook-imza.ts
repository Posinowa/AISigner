import "server-only";
import crypto from "crypto";

/**
 * GitHub webhook imza doğrulaması (#326).
 *
 * ⚠️ BU UÇ KİMLİK DOĞRULAMASIZ VE PUBLIC. Middleware'in `publicPaths`'inde;
 * oturum yok, çerez yok. Tek koruma bu imza — yanlış yazılırsa herkes
 * platformdaki adımları "tamamlandı" işaretleyebilir.
 *
 * GitHub gövdenin HMAC-SHA256'sını `X-Hub-Signature-256` başlığında
 * `sha256=<hex>` biçiminde yollar.
 *
 * ÜÇ KURAL:
 *
 * 1. HAM GÖVDE üzerinden doğrula. JSON parse edilip yeniden serileştirilirse
 *    bayt dizisi değişir (anahtar sırası, boşluk) ve imza tutmaz. Bu yüzden
 *    çağıran taraf `req.text()` kullanmalı, `req.json()` DEĞİL.
 *
 * 2. SABİT ZAMANLI karşılaştır. `===` ile karşılaştırmak, saldırganın imzayı
 *    bayt bayt tahmin etmesine yarayan bir zamanlama sızıntısı bırakır.
 *
 * 3. Sır tanımlı değilse HİÇBİR ŞEY doğrulanmış sayılmaz. "Sır yoksa geç"
 *    davranışı, yapılandırma unutulduğunda ucu tamamen açık bırakırdı.
 */

/** Sırrın tanımlı olup olmadığı — route yapılandırma hatasını ayırt edebilsin. */
export function webhookSirriVarMi(): boolean {
  return Boolean(process.env.GITHUB_WEBHOOK_SECRET?.trim());
}

export type ImzaSonucu =
  | { gecerli: true }
  | { gecerli: false; neden: "sir-yok" | "imza-yok" | "bicim-hatali" | "eslesmedi" };

/**
 * `X-Hub-Signature-256` başlığını ham gövdeye karşı doğrular.
 *
 * Hata FIRLATMAZ — çağıran taraf nedeni ayırt edip doğru HTTP kodunu seçsin.
 */
export function webhookImzasiniDogrula(
  hamGovde: string,
  imzaBasligi: string | null,
): ImzaSonucu {
  const sir = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!sir) return { gecerli: false, neden: "sir-yok" };

  if (!imzaBasligi) return { gecerli: false, neden: "imza-yok" };
  if (!imzaBasligi.startsWith("sha256=")) return { gecerli: false, neden: "bicim-hatali" };

  const gelen = imzaBasligi.slice("sha256=".length);
  const beklenen = crypto.createHmac("sha256", sir).update(hamGovde, "utf8").digest("hex");

  // Uzunluk farkı varsa timingSafeEqual FIRLATIR; önce ayıklıyoruz.
  // (Uzunluk zaten gizli bir bilgi değil — HMAC-SHA256 her zaman 64 hex.)
  if (gelen.length !== beklenen.length) return { gecerli: false, neden: "eslesmedi" };

  const esit = crypto.timingSafeEqual(Buffer.from(gelen), Buffer.from(beklenen));
  return esit ? { gecerli: true } : { gecerli: false, neden: "eslesmedi" };
}
