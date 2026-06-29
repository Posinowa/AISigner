/**
 * Deneyim seviyesi — tek kanonik format.
 *
 * #54: Onboarding küçük harf (`beginner`), bazı mentor UI'ları büyük harf
 * (`BEGINNER`) bekliyordu; bu da ham değer gösterimine ve tutarsız AI prompt'larına
 * yol açıyordu. Kanonik format projedeki diğer enum'larla (Role, AssignmentStatus...)
 * tutarlı olacak şekilde **UPPERCASE**'tir. Yazma/okuma/AI bu modülden geçer.
 */

export const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const DEFAULT_EXPERIENCE_LEVEL: ExperienceLevel = "BEGINNER";

/** UI gösterim etiketleri (Türkçe) — tek kaynak. */
export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  BEGINNER: "Başlangıç",
  INTERMEDIATE: "Orta",
  ADVANCED: "İleri",
};

/**
 * Farklı yazımları (küçük harf form değerleri, Türkçe etiketler, AI çıktısı)
 * kanonik UPPERCASE değerine indirger. Tanınmayan değer → DEFAULT.
 */
export function normalizeExperienceLevel(
  value: string | null | undefined,
): ExperienceLevel {
  const raw = (value ?? "").trim();

  // Türkçe etiketler / AI çıktısı (büyük-küçük harf İ/i tuzağından kaçınmak için
  // doğrudan eşleştiriyoruz).
  if (raw === "Başlangıç" || raw === "Başlangıç Seviye") return "BEGINNER";
  if (raw === "Orta" || raw === "Orta Seviye") return "INTERMEDIATE";
  if (raw === "İleri" || raw === "İleri Seviye") return "ADVANCED";

  switch (raw.toLowerCase()) {
    case "beginner":
    case "yeni başlayan":
      return "BEGINNER";
    case "intermediate":
      return "INTERMEDIATE";
    case "advanced":
      return "ADVANCED";
    default:
      return DEFAULT_EXPERIENCE_LEVEL;
  }
}

/** Herhangi bir yazımı Türkçe gösterim etiketine çevirir. */
export function experienceLevelLabel(value: string | null | undefined): string {
  return EXPERIENCE_LEVEL_LABELS[normalizeExperienceLevel(value)];
}
