import { z } from "zod";
import {
  MENTOR_KAPASITE_EN_AZ,
  MENTOR_KAPASITE_EN_COK,
  MENTOR_DENEYIM_EN_AZ,
  MENTOR_DENEYIM_EN_COK,
  HAFTALIK_SAAT_EN_AZ,
  HAFTALIK_SAAT_EN_COK,
} from "@/features/student/models/secenekler";

/**
 * #287: Mentör başvurusunun şeması.
 *
 * Sınırlar stajyer tarafıyla aynı modülden geliyor; iki taraf da aynı
 * sözlükten konuşmalı ki eşleştirme çalışsın.
 *
 * URL'ler OPSİYONEL ama boş dize de kabul ediliyor: form her zaman string
 * gönderiyor, "doldurmadım" ile "geçersiz" ayrı şeyler.
 */

/**
 * Boş dize "doldurmadım" demektir. Dönüşüm burada YAPILMAZ: zod transform
 * giriş/çıkış tiplerini ayırıyor ve react-hook-form giriş tipini bekliyor.
 * Normalleştirme kaydeden tarafta (server/basvuru.ts).
 */
const opsiyonelUrl = z
  .union([z.literal(""), z.string().url("Geçerli bir bağlantı girin")])
  .optional();

export const mentorBasvuruSchema = z.object({
  title: z.string().min(2, "Ünvanını yaz"),
  company: z.string().optional(),
  yearsExperience: z
    .number()
    .min(MENTOR_DENEYIM_EN_AZ, "Deneyim yılı negatif olamaz")
    .max(MENTOR_DENEYIM_EN_COK, "Geçerli bir deneyim yılı gir"),
  seniority: z.enum(["junior", "mid", "senior", "lead"]),
  expertise: z.array(z.string().min(1)).min(1, "En az bir uzmanlık alanı seç"),
  capacity: z
    .number()
    .min(MENTOR_KAPASITE_EN_AZ, `En az ${MENTOR_KAPASITE_EN_AZ} stajyer`)
    .max(MENTOR_KAPASITE_EN_COK, `En fazla ${MENTOR_KAPASITE_EN_COK} stajyer`),
  weeklyHours: z
    .number()
    .min(HAFTALIK_SAAT_EN_AZ, `En az ${HAFTALIK_SAAT_EN_AZ} saat`)
    .max(HAFTALIK_SAAT_EN_COK, `En fazla ${HAFTALIK_SAAT_EN_COK} saat`),
  motivation: z
    .string()
    .min(30, "Biraz daha açar mısın? (en az 30 karakter)")
    .max(2000, "En fazla 2000 karakter"),
  mentoringStyle: z
    .string()
    .min(30, "Biraz daha açar mısın? (en az 30 karakter)")
    .max(2000, "En fazla 2000 karakter"),
  githubUrl: opsiyonelUrl,
  linkedinUrl: opsiyonelUrl,
  city: z.string().optional(),
});

export type MentorBasvuru = z.infer<typeof mentorBasvuruSchema>;
