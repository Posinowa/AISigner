import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hash, verify } from "@node-rs/argon2";
import { SECURITY_QUESTIONS, REQUIRED_ANSWERS } from "@/lib/security-questions";
import { createRateLimiter } from "@/lib/rate-limit";
import crypto from "crypto";

const limiter = createRateLimiter("forgot-password", {
  maxRequests: 5,
  windowSeconds: 300, // 5 dakikada max 5 deneme
});

// Hesap bazlı rate limiting (email başına - IP spoofing önleme)
const accountLimiter = createRateLimiter("forgot-password-account", {
  maxRequests: 10,
  windowSeconds: 3600, // 1 saatte max 10 deneme per email
});

/**
 * Kısa ömürlü doğrulama tokenleri (step2→step3 arası).
 * token → { userId, expiresAt }
 * Güvenlik açığını kapatır: saldırgan step2'yi atlayıp step3'e gidemez.
 *
 * ⚠️ ÖLÇEKLEME: Bu Map proses-yereldir. Çok instance/serverless'ta step2 ve
 * step3 farklı instance'a düşerse token bulunamaz → Redis'e taşıyın (bkz. DEPLOYMENT.md).
 */
interface ResetToken {
  userId: string;
  expiresAt: number; // ms
}
const resetTokens = new Map<string, ResetToken>();

// Süresi dolan tokenleri temizle (her 5 dakikada bir)
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of resetTokens) {
    if (now > data.expiresAt) resetTokens.delete(token);
  }
}, 5 * 60 * 1000);

/**
 * POST /api/auth/forgot-password/verify
 * 1. Adım: Email gönder → kullanıcının güvenlik sorularını döndür
 * Body: { email: string }
 */
export async function POST(req: Request) {
  // IP bazlı rate limiting (x-real-ip daha güvenilir)
  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous";

  const rl = limiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yaptınız. Lütfen 5 dakika bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const { email, answers, newPassword, resetToken } = body as {
      email: string;
      answers?: { questionId: number; answer: string }[];
      newPassword?: string;
      resetToken?: string;
    };

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Geçerli bir email adresi girin." },
        { status: 400 }
      );
    }

    // Hesap bazlı rate limiting (IP spoofing'e karşı ek koruma)
    const normalizedEmail = email.toLowerCase().trim();
    const accountRl = accountLimiter.check(normalizedEmail);
    if (!accountRl.allowed) {
      return NextResponse.json(
        { error: "Bu hesap için çok fazla deneme yapıldı. Lütfen 1 saat bekleyin." },
        { status: 429, headers: { "Retry-After": String(accountRl.retryAfterSeconds) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        securityAnswers: true,
      },
    });

    // Kullanıcı bulunamasa bile aynı mesajı ver (enumeration önleme)
    if (!user || user.securityAnswers.length < REQUIRED_ANSWERS) {
      // Soruları gösterirken rastgele sorular göster (enumeration önleme)
      if (!answers) {
        return NextResponse.json({
          step: "questions",
          questions: getRandomQuestions(),
        });
      }
      return NextResponse.json(
        { error: "Güvenlik sorusu cevapları yanlış." },
        { status: 400 }
      );
    }

    // ADIM 1: Sadece email geldi → Soruları döndür
    if (!answers) {
      const questionIds = user.securityAnswers.map((a) => a.questionId);
      const questions = questionIds.map((qId) => ({
        questionId: qId,
        question: SECURITY_QUESTIONS[qId],
      }));

      return NextResponse.json({
        step: "questions",
        questions,
      });
    }

    // ADIM 2: Cevaplar geldi → Doğrula
    if (!Array.isArray(answers) || answers.length < REQUIRED_ANSWERS) {
      return NextResponse.json(
        { error: "Tüm güvenlik sorularını cevaplayın." },
        { status: 400 }
      );
    }

    let correctCount = 0;
    for (const ans of answers) {
      const stored = user.securityAnswers.find(
        (sa) => sa.questionId === ans.questionId
      );
      if (stored && ans.answer) {
        const isCorrect = await verify(
          stored.answer,
          ans.answer.trim().toLowerCase()
        );
        if (isCorrect) correctCount++;
      }
    }

    if (correctCount < REQUIRED_ANSWERS) {
      return NextResponse.json(
        { error: "Güvenlik sorusu cevapları yanlış. Lütfen tekrar deneyin." },
        { status: 400 }
      );
    }

    // ADIM 3: Token + yeni şifre → doğrula ve şifreyi güncelle
    // NOT: Artık answers tekrar doğrulanmıyor — resetToken yeterli kanıt
    if (newPassword) {
      // Token olmadan step 3'e geçiş engellenir
      if (!resetToken) {
        return NextResponse.json(
          { error: "Geçersiz istek. Lütfen sıfırlama işlemini baştan başlatın." },
          { status: 400 }
        );
      }
      const tokenData = resetTokens.get(resetToken);
      if (!tokenData || Date.now() > tokenData.expiresAt || tokenData.userId !== user.id) {
        resetTokens.delete(resetToken);
        return NextResponse.json(
          { error: "Doğrulama süresi doldu veya geçersiz. Lütfen tekrar deneyin." },
          { status: 400 }
        );
      }
      // Token tek kullanımlık: hemen sil
      resetTokens.delete(resetToken);
      // Şifre politikası kontrolü
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Yeni şifre en az 8 karakter olmalı." },
          { status: 400 }
        );
      }
      if (newPassword.length > 128) {
        return NextResponse.json(
          { error: "Yeni şifre en fazla 128 karakter olabilir." },
          { status: 400 }
        );
      }
      if (!/[A-Z]/.test(newPassword)) {
        return NextResponse.json(
          { error: "Yeni şifre en az bir büyük harf içermeli." },
          { status: 400 }
        );
      }
      if (!/[a-z]/.test(newPassword)) {
        return NextResponse.json(
          { error: "Yeni şifre en az bir küçük harf içermeli." },
          { status: 400 }
        );
      }
      if (!/[0-9]/.test(newPassword)) {
        return NextResponse.json(
          { error: "Yeni şifre en az bir rakam içermeli." },
          { status: 400 }
        );
      }
      if (!/[^A-Za-z0-9]/.test(newPassword)) {
        return NextResponse.json(
          { error: "Yeni şifre en az bir özel karakter içermeli." },
          { status: 400 }
        );
      }

      const hashedPassword = await hash(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      return NextResponse.json({
        step: "success",
        message: "Şifreniz başarıyla değiştirildi. Giriş yapabilirsiniz.",
      });
    }

    // Cevaplar doğru: kısa ömürlü reset tokeni oluştur (5 dakika geçerli)
    const token = crypto.randomBytes(32).toString("hex");
    resetTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return NextResponse.json({
      step: "verified",
      resetToken: token,
      message: "Güvenlik soruları doğrulandı. Yeni şifrenizi belirleyin.",
    });
  } catch (error) {
    console.error("POST /api/auth/forgot-password/verify error:", error);
    return NextResponse.json(
      { error: "İşlem sırasında hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * Enumeration önleme: Kullanıcı bulunamadığında rastgele sorular göster
 */
function getRandomQuestions() {
  const indices: number[] = [];
  while (indices.length < REQUIRED_ANSWERS) {
    const idx = Math.floor(Math.random() * SECURITY_QUESTIONS.length);
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices.map((qId) => ({
    questionId: qId,
    question: SECURITY_QUESTIONS[qId],
  }));
}
