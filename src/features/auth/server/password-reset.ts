import "server-only";
import { uygulamaUrl } from "@/lib/app-url";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import {
  createResetToken,
  parseResetToken,
  verifyResetToken,
} from "@/lib/auth/reset-token";

/**
 * #262: E-postayla şifre sıfırlama.
 *
 * Önceki akış güvenlik sorularına dayanıyordu ve ara tokenı süreç belleğinde
 * (`Map`) tutuyordu; çok instance'lı üretimde rastgele kırılıyordu. Artık
 * token imzalı ve durumsuz.
 */

function uygulamaAdresi(): string {
  return uygulamaUrl();
}

export function buildResetUrl(token: string): string {
  return `${uygulamaAdresi()}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Sıfırlama e-postası gönderir.
 *
 * Sözleşme: hesap olsun olmasın HATA FIRLATMAZ ve çağırana hesabın var olup
 * olmadığını SÖYLEMEZ. Enumeration'ı önleyen şey bu — uç her durumda aynı
 * yanıtı verebilsin.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    const kullanici = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, password: true },
    });

    // Hesap yok → sessizce çık. Kayıtsız adrese e-posta da gitmemeli.
    if (!kullanici?.password) return;

    const url = buildResetUrl(createResetToken(kullanici.id, kullanici.password));
    const hitap = kullanici.name?.trim() ? `Merhaba ${kullanici.name.trim()},` : "Merhaba,";

    await sendMail({
      to: email,
      subject: "AISigner — şifre sıfırlama",
      text: [
        hitap,
        "",
        "Hesabınız için şifre sıfırlama talebinde bulunuldu. Yeni şifrenizi",
        "belirlemek için aşağıdaki bağlantıya gidin:",
        "",
        url,
        "",
        "Bu bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir.",
        "Bu talebi siz yapmadıysanız bu iletiyi yok sayabilirsiniz; şifreniz",
        "değişmez.",
        "",
        "Posinowa",
      ].join("\n"),
    });
  } catch (error) {
    // Gönderim hatası kullanıcıya sızmamalı; aksi halde hata mesajından
    // hesabın var olduğu anlaşılabilir.
    logger.error("Şifre sıfırlama e-postası gönderilemedi", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export type SifirlamaSonuc =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Tokenı doğrular ve şifreyi değiştirir.
 *
 * Token, kullanıcının O ANKİ şifre hash'ine bağlı imzalandığı için şifre
 * değiştiği anda geçersizleşir — tek kullanımlık davranış buradan geliyor.
 */
export async function resetPassword(
  token: string,
  yeniSifre: string,
): Promise<SifirlamaSonuc> {
  const cozum = parseResetToken(token);
  if (!cozum.ok) return { ok: false, reason: "invalid" };

  const kullanici = await prisma.user.findUnique({
    where: { id: cozum.userId },
    select: { id: true, password: true },
  });

  // Kullanıcı yoksa imza doğrulanamaz; "geçersiz" deyip çıkıyoruz.
  if (!kullanici?.password) return { ok: false, reason: "invalid" };

  const sonuc = verifyResetToken(token, kullanici.password);
  if (!sonuc.valid) {
    // Süresi geçmiş tokenı ayrı bildiriyoruz ki kullanıcı yenisini isteyebilsin;
    // imza hatası ayrıntısı verilmiyor.
    return { ok: false, reason: sonuc.reason === "expired" ? "expired" : "invalid" };
  }

  await prisma.user.update({
    where: { id: kullanici.id },
    data: { password: await hash(yeniSifre) },
  });

  logger.info("Şifre sıfırlandı", { userId: kullanici.id });
  return { ok: true };
}
