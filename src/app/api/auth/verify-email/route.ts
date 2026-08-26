import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyVerificationToken } from "@/lib/auth/verification-token";
import { markEmailVerified } from "@/features/auth/server/email-verification";
import { logger } from "@/lib/logger";

/**
 * #247: E-posta doğrulama bağlantısının indiği yer.
 *
 * Oturum GEREKTİRMEZ — kullanıcı e-postadaki bağlantıya çoğu zaman giriş
 * yapmadan tıklar. Güvence tokenın imzasında; token `AUTH_SECRET` ile
 * imzalanmış ve kullanıcı kimliğini kendisi taşıyor.
 *
 * Sonuç kullanıcıya JSON değil, giriş ekranına yönlendirme + durum
 * parametresiyle bildirilir; bağlantıya tıklayan kişi tarayıcıda ham JSON
 * görmemeli.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const signin = (durum: string) =>
    NextResponse.redirect(new URL(`/signin?dogrulama=${durum}`, request.url));

  if (!token) return signin("gecersiz");

  const sonuc = verifyVerificationToken(token);
  if (!sonuc.valid) {
    // Nedeni loglanır ama KULLANICIYA ayrıntı verilmez: geçersiz imza ile
    // süresi geçmiş tokenı ayırt ettirmek bilgi sızdırır.
    logger.warn("E-posta doğrulama tokenı reddedildi", { reason: sonuc.reason });
    return signin(sonuc.reason === "expired" ? "suresi-gecti" : "gecersiz");
  }

  // Bağlantıya e-postadan tıklayan kullanıcı ham 500 görmemeli; veritabanı
  // geçici olarak erişilemezse de anlamlı bir ekrana düşsün.
  let kayit;
  try {
    kayit = await markEmailVerified(sonuc.userId);
  } catch (error) {
    logger.error("E-posta doğrulama sırasında beklenmeyen hata", {
      error: error instanceof Error ? error.message : String(error),
    });
    return signin("hata");
  }

  if (!kayit.ok) {
    logger.warn("Doğrulama tokenı geçerli ama kullanıcı yok", {
      reason: kayit.reason,
    });
    return signin("gecersiz");
  }

  return signin(kayit.alreadyVerified ? "zaten-dogrulanmis" : "tamam");
}
