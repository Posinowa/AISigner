/**
 * #147: Öneri & İstek modülünün ortak etiket/renk tanımları.
 * Öğrenci ve yönetici arayüzü aynı sözlüğü kullanır ki metinler ayrışmasın.
 */

export type SuggestionType = "SUGGESTION" | "REQUEST";
export type SuggestionStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";

export const typeLabels: Record<SuggestionType, string> = {
  SUGGESTION: "Öneri",
  REQUEST: "İstek",
};

export const typeStyles: Record<SuggestionType, string> = {
  SUGGESTION: "bg-indigo-50 text-indigo-700 border-indigo-200",
  REQUEST: "bg-blue-50 text-blue-700 border-blue-200",
};

export const statusLabels: Record<SuggestionStatus, string> = {
  OPEN: "Açık",
  IN_REVIEW: "İnceleniyor",
  RESOLVED: "Çözüldü",
};

export const statusStyles: Record<SuggestionStatus, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const statusOrder: SuggestionStatus[] = ["OPEN", "IN_REVIEW", "RESOLVED"];

/** Yazarın görünen adı — ad/soyad boşsa e-postaya düşer. */
export function authorDisplayName(author: {
  name: string | null;
  lastName: string | null;
  email: string;
}): string {
  const full = [author.name, author.lastName].filter(Boolean).join(" ").trim();
  return full || author.email;
}
