import "server-only";
import { uygulamaUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { createVerificationToken } from "@/lib/auth/verification-token";

/**
 * #247: Doğrulama e-postasının hazırlanması ve gönderilmesi.
 *
 * Sözleşme: bu fonksiyon hata FIRLATMAZ. Kayıt akışı e-posta gönderilemediği
 * için kırılmamalı — kullanıcı hesabını oluşturmuş olur, doğrulamayı sonra
 * yapabilir. (#241 ile aynı yaklaşım.)
 */

function uygulamaAdresi(): string {
  return uygulamaUrl();
}

export function buildVerificationUrl(token: string): string {
  return `${uygulamaAdresi()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(params: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<void> {
  const { userId, email, name } = params;

  try {
    const url = buildVerificationUrl(createVerificationToken(userId));
    const hitap = name?.trim() ? `Merhaba ${name.trim()},` : "Merhaba,";

    await sendMail({
      to: email,
      subject: "AISigner — e-posta adresinizi doğrulayın",
      text: [
        hitap,
        "",
        "AISigner hesabınızı oluşturduğunuz için teşekkürler. E-posta adresinizi",
        "doğrulamak için aşağıdaki bağlantıya gidin:",
        "",
        url,
        "",
        "Bu bağlantı 24 saat geçerlidir.",
        "Bu kaydı siz yapmadıysanız bu iletiyi yok sayabilirsiniz.",
        "",
        "Posinowa",
      ].join("\n"),
    });
  } catch (error) {
    // AUTH_SECRET eksikse createVerificationToken fırlatır; kayıt yine de
    // tamamlanmalı.
    logger.error("Doğrulama e-postası hazırlanamadı", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export type DogrulamaSonuc =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; reason: "invalid" | "user-not-found" };

/**
 * Tokenı doğrular ve `emailVerified` alanını doldurur.
 * Zaten doğrulanmış hesapta tarihi EZMEZ — ilk doğrulama anı korunur.
 */
export async function markEmailVerified(
  userId: string,
): Promise<DogrulamaSonuc> {
  const kullanici = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, emailVerified: true },
  });

  if (!kullanici) return { ok: false, reason: "user-not-found" };

  if (kullanici.emailVerified) {
    return { ok: true, alreadyVerified: true };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });

  logger.info("E-posta doğrulandı", { userId });
  return { ok: true, alreadyVerified: false };
}
