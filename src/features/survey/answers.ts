// #46: İstemci ve sunucu arasında paylaşılan saf yardımcılar (prisma/React bağımlılığı yok).

export type SurveyQuestionView = {
  id: string;
  question: string;
  options: string[];
};

export type SurveyAnswerPayload = {
  questionId: string;
  answer: string;
};

/**
 * Form state'indeki (questionId → cevap) map'inden backend'e gönderilecek
 * cevap dizisini üretir. Boş/whitespace cevaplar elenir (anket opsiyoneldir).
 */
export function buildSurveyAnswerPayload(
  answers: Record<string, string>,
): SurveyAnswerPayload[] {
  return Object.entries(answers)
    .map(([questionId, answer]) => ({ questionId, answer: answer.trim() }))
    .filter((a) => a.answer.length > 0);
}

/**
 * #83: POST /api/student/survey-answers hatasını okunabilir tek mesaja indirger.
 * Hata iki şekilde gelebilir: düz string (SurveyValidationError/500) veya zod
 * fieldErrors objesi (`{ answers: ["mesaj"] }`, 400 validation). Önceki kod
 * yalnızca string'i kontrol ediyordu; obje gelince genel/anlamsız bir mesaja
 * düşüyordu — validation hatası kullanıcıya görünmüyordu.
 */
export function extractSurveyErrorMessage(
  errorField: unknown,
  fallback: string,
): string {
  if (typeof errorField === "string" && errorField.trim().length > 0) {
    return errorField;
  }
  if (errorField && typeof errorField === "object") {
    const firstMessage = Object.values(errorField as Record<string, unknown>).flat()[0];
    if (firstMessage) return String(firstMessage);
  }
  return fallback;
}
