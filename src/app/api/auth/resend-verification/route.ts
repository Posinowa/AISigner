import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { createRateLimiter } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/features/auth/server/email-verification";

/**
 * #261: Doğrulama e-postasını yeniden gönderir.
 *
 * #247 doğrulama bağlantısını yalnızca KAYIT ANINDA gönderiyordu. E-posta
 * spam'e düştüyse, silindiyse veya 24 saatlik bağlantının süresi geçtiyse
 * kullanıcı sıkışıp kalıyordu — #259 ile "Doğrulanmamış" ibaresini görüp
 * hiçbir şey yapamıyordu.
 *
 * Hedef kullanıcı GÖVDEDEN değil OTURUMDAN geliyor: kimse başkasının
 * adresine e-posta tetikleyemesin.
 *
 * Enumeration riski YOK — kullanıcı zaten giriş yapmış, kendi adresini
 * biliyor. Bu yüzden "zaten doğrulanmış" bilgisini açıkça verebiliyoruz.
 */

// Kullanıcı başına: e-posta bombardımanına dönüşmesin.
const limiter = createRateLimiter("resend-verification", {
  maxRequests: 3,
  windowSeconds: 900, // 15 dakikada 3
});

export async function POST() {
  // PENDING stajyer de doğrulama isteyebilmeli — onay beklerken e-postasını
  // doğrulaması gereken tam olarak o kullanıcı (#143 istisnasıyla aynı gerekçe).
  const auth = await requireAuth(undefined, { allowUnapprovedStudent: true });
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "Oturum geçersiz." }, { status: 401 });
  }

  const kullanici = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true },
  });

  if (!kullanici) {
    return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });
  }

  // Zaten doğrulanmışsa e-posta göndermenin anlamı yok. Oran sınırı da
  // tüketilmiyor: kullanıcının hatası değil.
  if (kullanici.emailVerified) {
    return NextResponse.json({
      alreadyVerified: true,
      message: "Hesabınız zaten doğrulanmış.",
    });
  }

  const rl = limiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          "Çok fazla doğrulama e-postası istediniz. Lütfen bir süre bekleyip tekrar deneyin.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  // sendVerificationEmail hata FIRLATMAZ (#247); gönderim başarısız olsa da
  // kullanıcıya aynı mesaj veriliyor, ayrıntı loglanıyor.
  await sendVerificationEmail({
    userId: kullanici.id,
    email: kullanici.email,
    name: kullanici.name,
  });

  return NextResponse.json({
    message: "Doğrulama bağlantısı e-posta adresinize gönderildi.",
  });
}
