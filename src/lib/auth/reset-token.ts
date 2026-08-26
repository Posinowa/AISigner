import crypto from "crypto";

/**
 * #262: Şifre sıfırlama tokenı.
 *
 * Token DB'de saklanmaz; `AUTH_SECRET` ile HMAC imzalanır ve kullanıcı
 * kimliği + son kullanma zamanını kendi içinde taşır. Böylece
 * `forgot-password/verify` içindeki süreç-yerel `resetTokens` Map'ine
 * (çok instance'lı üretimde çalışmıyor) gerek kalmıyor.
 *
 * TEK KULLANIMLIK — anahtar burada: imza, kullanıcının O ANKİ ŞİFRE HASH'İNE
 * bağlanıyor. Şifre değişince hash değişir ve token kendiliğinden geçersiz
 * olur. Bu, iptal listesi tutmadan tek kullanımlık davranışı veriyor.
 * Yan faydası: kullanıcı şifresini başka bir yolla değiştirirse bekleyen tüm
 * sıfırlama bağlantıları da ölür.
 *
 * Doğrulama tokenından (#247) farkı bu bağlama; oradaki token hesabı yalnızca
 * doğruladığı için tekrar kullanılması zararsızdı.
 */

const AYIRAC = ".";
const VARSAYILAN_OMUR_MS = 60 * 60 * 1000; // 1 saat — sıfırlama kısa ömürlü olmalı

function gizliAnahtar(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET tanımlı değil — sıfırlama tokenı üretilemez.");
  }
  return secret;
}

/**
 * İmza anahtarı: sunucu sırrı + kullanıcının mevcut şifre hash'i.
 *
 * Şifre hash'i token'ın İÇİNE konmaz, yalnızca anahtara karışır — token ele
 * geçse bile hash sızmaz.
 */
function imzala(govde: string, sifreHash: string): string {
  return crypto
    .createHmac("sha256", `${gizliAnahtar()}${AYIRAC}${sifreHash}`)
    .update(govde)
    .digest("base64url");
}

/** `<userId>.<sonKullanma>.<imza>` biçiminde token üretir. */
export function createResetToken(
  userId: string,
  sifreHash: string,
  omurMs: number = VARSAYILAN_OMUR_MS,
): string {
  const sonKullanma = Date.now() + omurMs;
  const govde = `${userId}${AYIRAC}${sonKullanma}`;
  return `${govde}${AYIRAC}${imzala(govde, sifreHash)}`;
}

export type ResetTokenSonuc =
  | { valid: true; userId: string }
  | { valid: false; reason: "malformed" | "bad-signature" | "expired" };

/**
 * Tokenın biçimini çözer. İmza doğrulanmadan YALNIZCA kullanıcı kimliğini
 * verir — çağıran taraf o kimlikle şifre hash'ini çekip imzayı doğrulamalı.
 */
export function parseResetToken(
  token: string,
): { ok: true; userId: string; govde: string; imza: string } | { ok: false } {
  const parcalar = token.split(AYIRAC);
  if (parcalar.length !== 3) return { ok: false };

  const [userId, sonKullanmaMetin, imza] = parcalar;
  if (!userId || !sonKullanmaMetin || !imza) return { ok: false };
  if (!Number.isFinite(Number(sonKullanmaMetin))) return { ok: false };

  return {
    ok: true,
    userId,
    govde: `${userId}${AYIRAC}${sonKullanmaMetin}`,
    imza,
  };
}

/**
 * Tokenı doğrular. Hata FIRLATMAZ.
 *
 * `sifreHash` kullanıcının veritabanındaki güncel hash'i olmalı.
 */
export function verifyResetToken(
  token: string,
  sifreHash: string,
): ResetTokenSonuc {
  const cozum = parseResetToken(token);
  if (!cozum.ok) return { valid: false, reason: "malformed" };

  const beklenen = imzala(cozum.govde, sifreHash);

  // Sabit zamanlı karşılaştırma: imza tahmininde zamanlama sızıntısı olmasın.
  const a = Buffer.from(cozum.imza);
  const b = Buffer.from(beklenen);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad-signature" };
  }

  // Süre kontrolü imzadan SONRA: geçersiz imzalı token için süre bilgisi
  // sızdırmayalım.
  const sonKullanma = Number(cozum.govde.split(AYIRAC)[1]);
  if (Date.now() > sonKullanma) return { valid: false, reason: "expired" };

  return { valid: true, userId: cozum.userId };
}
