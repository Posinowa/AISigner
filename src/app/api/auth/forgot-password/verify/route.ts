import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hash, verify } from "@node-rs/argon2";
import { SECURITY_QUESTIONS, REQUIRED_ANSWERS } from "@/lib/security-questions";
import { createRateLimiter } from "@/lib/rate-limit";
import crypto from "crypto";

/**
 * #149: Kullanıcı bulunamadığında da argon2 doğrulaması çalıştırmak için sabit
 * bir hash. Aksi halde "hesap yok" yanıtı belirgin şekilde daha hızlı döner ve
 * hesabın varlığı yanıt süresinden okunabilir (nextauth.ts ile aynı desen).
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hash("aisigner-dummy-answer-for-constant-time-verify");
  }
  return dummyHashPromise;
}

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

// Süresi dolan tokenleri temizle (her 5 dakikada bir).
// unref: bu zamanlayıcı tek başına prosesi ayakta tutmasın.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [token, data] of resetTokens) {
    if (now > data.expiresAt) resetTokens.delete(token);
  }
}, 5 * 60 * 1000);
sweeper.unref?.();

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

  // #149: Kotayı **peek** ile yokla, tüketme. Meşru akış üç istek sürüyor
  // (e-posta → cevaplar → yeni şifre); her istekte saymak kullanıcının kendi
  // sıfırlamasını yarıda kilitliyordu. Kota yalnızca başarısız denemelerde ve
  // hesap yoklamaya açık 1. adımda tüketilir.
  const rl = limiter.peek(ip);
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
      // Bozuk istek de kota tüketsin — aksi halde sınırsız zorlanabilir.
      limiter.check(ip);
      return NextResponse.json(
        { error: "Geçerli bir email adresi girin." },
        { status: 400 }
      );
    }

    // Hesap bazlı rate limiting (IP spoofing'e karşı ek koruma)
    const normalizedEmail = email.toLowerCase().trim();

    /** Bir denemeyi iki limitte de say (başarısızlık / hesap yoklama). */
    const consumeAttempt = () => {
      limiter.check(ip);
      accountLimiter.check(normalizedEmail);
    };

    const accountRl = accountLimiter.peek(normalizedEmail);
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
      if (!answers) {
        // #149: Sahte sorular e-postadan **türetilir**, rastgele seçilmez.
        // Rastgele seçimde aynı e-posta iki kez sorulduğunda kayıtlı hesap hep
        // aynı üçlüyü, kayıtsız hesap her seferinde farklı üçlüyü döndürüyordu;
        // bu tek başına hesabın var olup olmadığını ele veriyordu.
        consumeAttempt();
        return NextResponse.json({
          step: "questions",
          questions: getDecoyQuestions(normalizedEmail),
        });
      }

      // #149: Hesap yokken de argon2 çalıştır — "hesap yok" yanıtı gerçek
      // doğrulamadan belirgin şekilde hızlı dönmesin.
      const dummy = await getDummyHash();
      for (let i = 0; i < REQUIRED_ANSWERS; i++) {
        await verify(dummy, "gecersiz-cevap").catch(() => false);
      }

      consumeAttempt();
      return NextResponse.json(
        { error: "Güvenlik sorusu cevapları yanlış." },
        { status: 400 }
      );
    }

    // ADIM 1: Sadece email geldi → Soruları döndür
    if (!answers) {
      consumeAttempt();
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
      consumeAttempt();
      return NextResponse.json(
        { error: "Tüm güvenlik sorularını cevaplayın." },
        { status: 400 }
      );
    }

    // #149: Doğru cevaplar **soru bazında tekilleştirilerek** sayılır.
    // Önceden her dizi elemanı ayrı sayıldığı için aynı doğru cevabı üç kez
    // göndermek doğrulamayı geçiyordu — yani üç cevaptan birini bilen biri
    // şifreyi sıfırlayabiliyordu.
    const correctQuestionIds = new Set<number>();
    for (const ans of answers) {
      if (correctQuestionIds.has(ans.questionId)) continue;

      const stored = user.securityAnswers.find(
        (sa) => sa.questionId === ans.questionId
      );
      if (stored && ans.answer) {
        const isCorrect = await verify(
          stored.answer,
          ans.answer.trim().toLowerCase()
        );
        if (isCorrect) correctQuestionIds.add(ans.questionId);
      }
    }

    if (correctQuestionIds.size < REQUIRED_ANSWERS) {
      consumeAttempt();
      return NextResponse.json(
        { error: "Güvenlik sorusu cevapları yanlış. Lütfen tekrar deneyin." },
        { status: 400 }
      );
    }

    // ADIM 3: Token + yeni şifre → doğrula ve şifreyi güncelle.
    // Buraya ulaşmak için cevaplar yukarıda **yeniden** doğrulandı; resetToken
    // buna ek bir kanıt (step2'yi atlayıp doğrudan step3'e gidilemesin diye).
    if (newPassword) {
      // Token olmadan step 3'e geçiş engellenir
      if (!resetToken) {
        consumeAttempt();
        return NextResponse.json(
          { error: "Geçersiz istek. Lütfen sıfırlama işlemini baştan başlatın." },
          { status: 400 }
        );
      }
      const tokenData = resetTokens.get(resetToken);
      if (!tokenData || Date.now() > tokenData.expiresAt || tokenData.userId !== user.id) {
        resetTokens.delete(resetToken);
        consumeAttempt();
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

      // #149: Sıfırlama başarıyla bittiğine göre bu kimlikler şüpheli değil;
      // kullanıcı hemen ardından tekrar giriş akışına girerse kilitlenmesin.
      limiter.reset(ip);
      accountLimiter.reset(normalizedEmail);

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
 * Enumeration önleme: kullanıcı bulunamadığında da soru döndürülür, ama sorular
 * e-postadan **deterministik** olarak türetilir (#149).
 *
 * Rastgele seçimde aynı e-posta için ikinci istek farklı sorular getiriyordu;
 * kayıtlı hesap ise her zaman aynı üçlüyü döndürdüğü için iki istek atmak
 * hesabın varlığını ele veriyordu. Tohum gizli anahtarla HMAC'lenir ki
 * saldırgan "bu üçlü sahte mi" diye çevrimdışı hesaplayamasın.
 */
function getDecoyQuestions(email: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? "aisigner-decoy-fallback";
  const seed = crypto.createHmac("sha256", secret).update(email).digest();

  const indices: number[] = [];
  for (let i = 0; i < seed.length && indices.length < REQUIRED_ANSWERS; i++) {
    const idx = seed[i] % SECURITY_QUESTIONS.length;
    if (!indices.includes(idx)) indices.push(idx);
  }
  // Teorik olarak tohum yetmezse sırayla tamamla (uzunluk garantisi, dizi sınırları korumalı).
  for (let q = 0; q < SECURITY_QUESTIONS.length && indices.length < REQUIRED_ANSWERS; q++) {
    if (!indices.includes(q)) indices.push(q);
  }

  return indices.map((qId) => ({
    questionId: qId,
    question: SECURITY_QUESTIONS[qId],
  }));
}
