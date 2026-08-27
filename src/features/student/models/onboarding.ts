import { z } from "zod";
import {
  DOGUM_YILI_EN_ERKEN,
  dogumYiliEnGec,
  HAFTALIK_SAAT_EN_AZ,
  HAFTALIK_SAAT_EN_COK,
} from "./secenekler";

/**
 * #289: Sınırlar `secenekler`ten geliyor. Önceden doğum yılı burada mevcut
 * yıla kadar izinliyken formun içindeki şema `max(2015)` diyordu — aynı alan
 * iki yerde farklı sınırlanıyordu.
 *
 * Yeni alanlar OPSİYONEL: eski istemciden gelen istek reddedilmemeli.
 */

export const personalSchema = z.object({
    firstName: z.string().min(2, "İsim en az 2 karakterli olmalı"),
    lastName: z.string().min(2, "Soyisim en az 2 karakterli olmalı"),
    
    birthYear: z.number().refine(
    (val) => val >= DOGUM_YILI_EN_ERKEN && val <= dogumYiliEnGec(),
    { message: `${DOGUM_YILI_EN_ERKEN} ile ${dogumYiliEnGec()} arasında bir değer girin` },
  ),
    phoneNumber: z
  .string()
  .min(1, "Telefon numarası gerekli")
  .transform((val) => val.replace(/[\s\-().]/g, "")) // boşluk/tire/parantez sil
  .pipe(
    z
      .string()
      .regex(/^\+?\d{10,15}$/, "Telefon numarası geçerli formatta olmalı (10-15 rakam)")
  ),
  /** #289: 81 il hedefi ancak sorulursa ölçülebilir. */
  city: z.string().min(2).optional(),
});


/** #289: Eğitim durumu — staj eşleştirmesinin en doğal ölçütü. */
export const educationSchema = z.object({
  school: z.string().min(2).optional(),
  department: z.string().min(2).optional(),
  classYear: z.string().min(1).optional(),
  englishLevel: z.string().min(1).optional(),
});

export const experienceSchema = z.object({
 level: z.enum(["beginner", "intermediate", "advanced"]),
  interest: z.array(z.string().min(1)).min(1, "En az bir ilgi alanı seçiniz"),
  /** #289: Platformun iş akışı GitHub üzerinden; mentörün bunu bilmesi şart. */
  gitLevel: z.enum(["none", "basic", "branching", "pr"]).optional(),

})

export const goalsSchema = z.object({
  goal: z.string().min(10, "Hedefinizi biraz daha detaylandırın"),
  /** Eski kayıtlar bu kovalarla dolu; yeni istemci saat gönderiyor. */
  availability: z.enum(["full-time", "part-time", "weekends"]).optional(),
  weeklyHours: z.number().min(HAFTALIK_SAAT_EN_AZ).max(HAFTALIK_SAAT_EN_COK).optional(),
})

export const onboardingSchema = z.object({
  personal: personalSchema,
  education: educationSchema.optional(),
  experience: experienceSchema,
  goals: goalsSchema,
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
