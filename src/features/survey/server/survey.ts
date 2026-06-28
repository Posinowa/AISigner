import { prisma } from "@/lib/db";

// #45: Admin yönetimli anket soruları + öğrenci cevapları için sunucu katmanı.

export type CreateSurveyQuestionData = {
  question: string;
  options?: string[];
  order?: number;
  isActive?: boolean;
};

export type UpdateSurveyQuestionData = Partial<CreateSurveyQuestionData>;

export type SurveyAnswerInput = {
  questionId: string;
  answer: string;
};

/** Anket sorularını sıralı listeler. activeOnly → yalnızca aktif sorular (öğrenci tarafı için). */
export async function listSurveyQuestions(opts?: { activeOnly?: boolean }) {
  return prisma.surveyQuestion.findMany({
    where: opts?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function createSurveyQuestion(data: CreateSurveyQuestionData) {
  return prisma.surveyQuestion.create({
    data: {
      question: data.question,
      options: data.options ?? [],
      order: data.order ?? 0,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateSurveyQuestion(id: string, data: UpdateSurveyQuestionData) {
  return prisma.surveyQuestion.update({
    where: { id },
    data,
  });
}

export async function deleteSurveyQuestion(id: string) {
  await prisma.surveyQuestion.delete({ where: { id } });
}

/** Öğrenci cevap doğrulama hatası — route bunu 4xx'e çevirir. */
export class SurveyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurveyValidationError";
  }
}

/**
 * Öğrencinin anket cevaplarını profile bağlı olarak kaydeder (soru başına upsert).
 * Geçersiz/pasif soru ID'si veya profil yoksa SurveyValidationError fırlatır.
 */
export async function saveSurveyAnswers(userId: string, answers: SurveyAnswerInput[]) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    throw new SurveyValidationError("Öğrenci profili bulunamadı. Önce profilinizi tamamlayın.");
  }

  // Yalnızca var olan aktif sorulara cevap verilebilir.
  const questionIds = [...new Set(answers.map((a) => a.questionId))];
  const validQuestions = await prisma.surveyQuestion.findMany({
    where: { id: { in: questionIds }, isActive: true },
    select: { id: true },
  });
  const validIds = new Set(validQuestions.map((q) => q.id));

  const unknown = questionIds.filter((id) => !validIds.has(id));
  if (unknown.length > 0) {
    throw new SurveyValidationError("Geçersiz veya pasif soru içeren cevaplar gönderildi.");
  }

  await prisma.$transaction(
    answers.map((a) =>
      prisma.surveyAnswer.upsert({
        where: {
          questionId_studentProfileId: {
            questionId: a.questionId,
            studentProfileId: profile.id,
          },
        },
        update: { answer: a.answer },
        create: {
          questionId: a.questionId,
          studentProfileId: profile.id,
          answer: a.answer,
        },
      }),
    ),
  );

  return { saved: answers.length };
}
