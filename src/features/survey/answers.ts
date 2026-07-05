// #46: İstemci ve sunucu arasında paylaşılan saf yardımcılar (prisma/React bağımlılığı yok).

import { extractApiErrorMessage } from "@/lib/api-error";

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
 * #89: Ortak `extractApiErrorMessage`'e delege edildi — aynı davranış, tek kaynak.
 * Bu isim survey çağrı yerleri ve mevcut testler için korunuyor.
 */
export function extractSurveyErrorMessage(errorField: unknown, fallback: string): string {
  return extractApiErrorMessage(errorField, fallback);
}
