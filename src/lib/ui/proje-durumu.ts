import { AlertCircle, CheckCircle, Clock } from "lucide-react";

/**
 * Proje durumu ve zorluk etiketlerinin TEK kaynağı.
 *
 * NEDEN MERKEZİ: Aynı haritalar mentör panosunda ve öğrenci detay sayfasında
 * ayrı ayrı yazılıydı ve renkleri birbirinden ayrışmıştı. Bu modül mentör
 * panosundaki palet (emerald başarı, amber uyarı, red hata) esas alınarak
 * birleştirildi; CLAUDE.md tasarım sistemiyle uyumludur.
 */

export const PROJE_DURUMU_ETIKETI = {
  PENDING: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-700", icon: AlertCircle },
  COMPLETED: { label: "Tamamlandı", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
};

export const ZORLUK_ETIKETI = {
  EASY: { label: "Kolay", color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  MEDIUM: { label: "Orta", color: "bg-amber-50 text-amber-700 border border-amber-200" },
  HARD: { label: "Zor", color: "bg-red-50 text-red-700 border border-red-200" },
};
