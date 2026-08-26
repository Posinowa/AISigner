import crypto from "crypto";

/**
 * #247: E-posta doğrulama tokenı.
 *
 * Token DB'de saklanmaz; `AUTH_SECRET` ile HMAC imzalanır ve kendi içinde
 * kullanıcı kimliği + son kullanma zamanı taşır.
 *
 * Neden tablo yok:
 * - `emailVerified` alanı şemada zaten var, migration gerekmiyor
 * - Süreç belleğinde durum tutulmuyor — `forgot-password` içindeki
 *   `resetTokens` çok instance'lı üretimde çalışmıyor (`CLAUDE.md` notu);
 *   aynı tuzağa düşmüyoruz
 *
 * Karşı taraf: token tek tek iptal edilemez. Kısa ömür (24 saat) bunu
 * kabul edilebilir kılıyor.
 */

const AYIRAC = ".";
const VARSAYILAN_OMUR_MS = 24 * 60 * 60 * 1000; // 24 saat

function gizliAnahtar(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET tanımlı değil — doğrulama tokenı üretilemez.");
  }
  return secret;
}

function imzala(govde: string): string {
  return crypto
    .createHmac("sha256", gizliAnahtar())
    .update(govde)
    .digest("base64url");
}

/** `<userId>.<sonKullanma>.<imza>` biçiminde token üretir. */
export function createVerificationToken(
  userId: string,
  omurMs: number = VARSAYILAN_OMUR_MS,
): string {
  const sonKullanma = Date.now() + omurMs;
  const govde = `${userId}${AYIRAC}${sonKullanma}`;
  return `${govde}${AYIRAC}${imzala(govde)}`;
}

export type TokenSonuc =
  | { valid: true; userId: string }
  | { valid: false; reason: "malformed" | "bad-signature" | "expired" };

/**
 * Tokenı doğrular. Hata FIRLATMAZ; çağıran taraf nedeni ayırt edebilsin diye
 * yapılandırılmış sonuç döner.
 */
export function verifyVerificationToken(token: string): TokenSonuc {
  const parcalar = token.split(AYIRAC);
  if (parcalar.length !== 3) return { valid: false, reason: "malformed" };

  const [userId, sonKullanmaMetin, imza] = parcalar;
  if (!userId || !sonKullanmaMetin || !imza) {
    return { valid: false, reason: "malformed" };
  }

  const sonKullanma = Number(sonKullanmaMetin);
  if (!Number.isFinite(sonKullanma)) {
    return { valid: false, reason: "malformed" };
  }

  const beklenen = imzala(`${userId}${AYIRAC}${sonKullanmaMetin}`);

  // Sabit zamanlı karşılaştırma: imza tahmininde zamanlama sızıntısı olmasın.
  const a = Buffer.from(imza);
  const b = Buffer.from(beklenen);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad-signature" };
  }

  // Süre kontrolü imzadan SONRA: geçersiz imzalı bir token için süre bilgisi
  // sızdırmayalım.
  if (Date.now() > sonKullanma) return { valid: false, reason: "expired" };

  return { valid: true, userId };
}
