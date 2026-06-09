import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { hash } from "@node-rs/argon2";
import { SECURITY_QUESTIONS, REQUIRED_ANSWERS } from "@/lib/security-questions";

/**
 * GET /api/auth/security-questions
 * Mevcut kullanıcının güvenlik sorularını kurmuş mu kontrol eder.
 */
export async function GET() {
  const auth = await requireAuth(["ADMIN", "MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;

  const answers = await prisma.securityAnswer.findMany({
    where: { userId },
    select: { questionId: true },
  });

  return NextResponse.json({
    isSetup: answers.length >= REQUIRED_ANSWERS,
    questionCount: answers.length,
    questions: SECURITY_QUESTIONS,
    answeredQuestionIds: answers.map((a) => a.questionId),
  });
}

/**
 * POST /api/auth/security-questions
 * Güvenlik sorularını cevapları ile birlikte kaydet (hashlenmiş).
 * Body: { answers: [{ questionId: number, answer: string }, ...] }
 */
export async function POST(req: Request) {
  const auth = await requireAuth(["ADMIN", "MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;

  try {
    const body = await req.json();
    const { answers } = body as {
      answers: { questionId: number; answer: string }[];
    };

    // Validasyon
    if (!answers || !Array.isArray(answers) || answers.length < REQUIRED_ANSWERS) {
      return NextResponse.json(
        { error: `En az ${REQUIRED_ANSWERS} güvenlik sorusu cevaplanmalı.` },
        { status: 400 }
      );
    }

    // Soru ID'lerinin geçerli olduğunu kontrol et
    for (const a of answers) {
      if (
        typeof a.questionId !== "number" ||
        a.questionId < 0 ||
        a.questionId >= SECURITY_QUESTIONS.length
      ) {
        return NextResponse.json(
          { error: "Geçersiz soru numarası." },
          { status: 400 }
        );
      }
      if (!a.answer || typeof a.answer !== "string" || a.answer.trim().length < 2) {
        return NextResponse.json(
          { error: "Her cevap en az 2 karakter olmalıdır." },
          { status: 400 }
        );
      }
    }

    // Mevcut cevapları sil ve yenilerini kaydet
    await prisma.securityAnswer.deleteMany({ where: { userId } });

    const hashedAnswers = await Promise.all(
      answers.map(async (a) => ({
        userId,
        questionId: a.questionId,
        answer: await hash(a.answer.trim().toLowerCase()),
      }))
    );

    await prisma.securityAnswer.createMany({ data: hashedAnswers });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/security-questions error:", error);
    return NextResponse.json(
      { error: "Güvenlik soruları kaydedilirken hata oluştu." },
      { status: 500 }
    );
  }
}
