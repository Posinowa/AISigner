"use server"

import { revalidateTag } from "next/cache"
import { z } from "zod"
import { personalSchema, educationSchema, experienceSchema, goalsSchema } from "../models/onboarding"
import { prisma } from "@/lib/auth/prisma"
import { requireAuth } from "@/lib/auth/guard"
import { normalizeExperienceLevel } from "@/lib/experience-level"
import { generateAndPersistProfileAnalysis } from "@/features/ai/server/profile-analysis-store"
import { logger } from "@/lib/logger"
import { aiRizasiVar } from "@/features/kvkk/riza"

// Tek birleşik şema
const onboardingSchema = z.object({
  personal: personalSchema,
  // #289: Eski istemciden gelen istek reddedilmesin diye opsiyonel.
  education: educationSchema.optional(),
  experience: experienceSchema,
  goals: goalsSchema,
})

export async function saveOnboarding(rawData: unknown) {
  /*
   * 1. Kullanıcı doğrulama
   *
   * #143 SÖZLEŞMESİ KORUNUYOR ama artık `requireAuth` ÜZERİNDEN: profil
   * tamamlama tam da hesap PENDING iken yapılır (onay bu adımdan SONRA
   * gelir), o yüzden `allowUnapprovedStudent` şart.
   *
   * ⚠️ Buradaki yorum eskiden "requireAuth KULLANILMAZ, akışı kırar" diyordu.
   * Doğruydu — `allowUnapprovedStudent` seçeneği EKLENMEDEN önce. Seçenek
   * #143 ile geldi ve API uçlarına uygulandı (ör. `student/survey-answers`),
   * ama bu çağrı yeri hiç taşınmadı. Sonuç, düz `getServerSession`'ın
   * SORMADIĞI iki soruydu:
   *
   *   1. REJECTED stajyer. Middleware yalnız SAYFAYI kapatıyor; server
   *      action doğrudan çağrılabildiği için reddedilmiş hesap profilini
   *      yazmaya devam edebiliyordu.
   *   2. Rol. MENTOR/ADMIN oturumu kendine bir `StudentProfile` üretebiliyor
   *      ve `User.name/lastName/phone` alanlarını bu yoldan değiştirebiliyordu.
   *
   * Mesajlar guard'ın kendi metinleri — istemci aynı durumu iki farklı
   * cümleyle görmesin (#375'in dersi).
   */
  const auth = await requireAuth("STUDENT", { allowUnapprovedStudent: true })
  if (!auth.authorized) {
    const govde = await auth.response
      .json()
      .catch(() => ({ error: null as string | null }))
    throw new Error(govde.error ?? "Bu işlem için yetkiniz bulunmuyor.")
  }
  // `requireAuth` oturumsuz isteği 401 ile çeviriyor, yani buraya gelen her
  // istekte kimlik VAR — tip bunu ifade edemediği için tek yerde daraltıyoruz.
  const userId = auth.session.user.id!

  // 2. Veri doğrulama
  const parse = onboardingSchema.safeParse(rawData)
  if (!parse.success) {
    throw new Error("Geçersiz veri: " + JSON.stringify(parse.error.flatten()))
  }
  const data = parse.data

  // #54: Deneyim seviyesini kanonik UPPERCASE'e normalize ederek sakla
  // (UI ve AI tek standart formatla çalışsın).
  const experienceLevel = normalizeExperienceLevel(data.experience.level)

  // 3. User + StudentProfile'ı atomik güncelle (firstName/lastName/phone User'da, profil alanları StudentProfile'da)
  const [, studentProfile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: data.personal.firstName,
        lastName: data.personal.lastName,
        phone: data.personal.phoneNumber,
      },
    }),
    prisma.studentProfile.upsert({
      where: { userId },
      update: {
        experienceLevel,
        interests: data.experience.interest,
        goals: data.goals.goal,
        availability: data.goals.availability,
        birthYear: data.personal.birthYear,
        // #289: Yeni başvuru soruları. Gelmeyeni null yazmak yerine undefined
        // bırakıyoruz ki mevcut değer SİLİNMESİN.
        city: data.personal.city,
        gitLevel: data.experience.gitLevel,
        weeklyHours: data.goals.weeklyHours,
        school: data.education?.school,
        department: data.education?.department,
        classYear: data.education?.classYear,
        englishLevel: data.education?.englishLevel,
      },
      create: {
        userId,
        experienceLevel,
        interests: data.experience.interest,
        goals: data.goals.goal,
        availability: data.goals.availability,
        birthYear: data.personal.birthYear,
        // #289: Yeni başvuru soruları. Gelmeyeni null yazmak yerine undefined
        // bırakıyoruz ki mevcut değer SİLİNMESİN.
        city: data.personal.city,
        gitLevel: data.experience.gitLevel,
        weeklyHours: data.goals.weeklyHours,
        school: data.education?.school,
        department: data.education?.department,
        classYear: data.education?.classYear,
        englishLevel: data.education?.englishLevel,
      },
    }),
  ])

  // 4. #47: Detaylı AI analizini üret + kalıcı sakla. Best-effort — hata olursa
  // onboarding akışı kırılmaz (analyzeStudentProfile zaten fallback döndürür;
  // yalnızca DB persist hatasına karşı try/catch).
  // #321: KVKK açık rıza yoksa AI analizi HİÇ üretilmez — profil verisi yurt
  // dışına çıkmaz. Öğrenci rızayı sonradan verirse analiz o zaman üretilir.
  const rizaVar = await aiRizasiVar(userId)

  try {
    if (rizaVar) await generateAndPersistProfileAnalysis(studentProfile.id, {
      experienceLevel,
      interests: data.experience.interest,
      goals: data.goals.goal,
      availability: data.goals.availability,
      // #289: Yeni sorular analize de girsin — yoksa zenginleşen veri yalnızca
      // DB'de durur, yol haritasına hiç yansımaz.
      gitLevel: data.experience.gitLevel,
      weeklyHours: data.goals.weeklyHours,
      englishLevel: data.education?.englishLevel,
      school: data.education?.school,
      department: data.education?.department,
      classYear: data.education?.classYear,
      city: data.personal.city,
    })
  } catch (error) {
    logger.error("Onboarding: profil analizi kaydedilemedi", error)
  }

  // 5. Profil değişti → AI özet cache'ini invalidate et
  revalidateTag(`profile-summary-${userId}`)

  // Client component zaten window.location.href ile yönlendiriyor,
  // burada redirect() çağırmıyoruz — server action'dan programatik
  // çağrılınca NEXT_REDIRECT, client catch bloğu tarafından Error: aborted
  // olarak yakalanıp yanlış alert gösteriyordu.
}
