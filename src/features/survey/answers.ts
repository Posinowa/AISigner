// #46: İstemci ve sunucu arasında paylaşılan saf yardımcılar (prisma/React bağımlılığı yok).

import { extractApiErrorMessage } from "@/lib/api-error-message";

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
 * fieldErrors objesi (`{ answers: ["mesaj"] }`, 400 validation).
 *
 * #126-3: Ayrıştırma mantığı ortak `extractApiErrorMessage`'a delege edilir —
 * tek kaynak. Buradaki imza *hata alanını* alır (tüm gövdeyi değil), bu yüzden
 * helper'ın beklediği `{ error }` şekline sarmalanır.
 */
export function extractSurveyErrorMessage(
  errorField: unknown,
  fallback: string,
): string {
  return extractApiErrorMessage({ error: errorField }, fallback);
}
