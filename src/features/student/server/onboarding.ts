"use server"

import { revalidateTag } from "next/cache"
import { z } from "zod"
import { personalSchema, educationSchema, experienceSchema, goalsSchema } from "../models/onboarding"
import { prisma } from "@/lib/auth/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/nextauth"
import { normalizeExperienceLevel } from "@/lib/experience-level"
import { generateAndPersistProfileAnalysis } from "@/features/ai/server/profile-analysis-store"
import { logger } from "@/lib/logger"

// Tek birleşik şema
const onboardingSchema = z.object({
  personal: personalSchema,
  // #289: Eski istemciden gelen istek reddedilmesin diye opsiyonel.
  education: educationSchema.optional(),
  experience: experienceSchema,
  goals: goalsSchema,
})

export async function saveOnboarding(rawData: unknown) {
  // 1. Kullanıcı doğrulama
  // #143 SÖZLEŞME: Burada bilerek `requireAuth` KULLANILMAZ. requireAuth,
  // APPROVED olmayan STUDENT'ı 403 ile engeller; oysa profil tamamlama tam da
  // hesap PENDING iken yapılır (onay bu adımdan SONRA gelir). Doğrudan
  // getServerSession ile yalnızca oturum kontrol edilir. Bunu `requireAuth`e
  // çevirmek onboarding akışını kırar — detay: guard.ts `allowUnapprovedStudent`.
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Oturum bulunamadı")
  }

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
      where: { id: session.user.id },
      data: {
        name: data.personal.firstName,
        lastName: data.personal.lastName,
        phone: data.personal.phoneNumber,
      },
    }),
    prisma.studentProfile.upsert({
      where: { userId: session.user.id },
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
        userId: session.user.id,
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
  try {
    await generateAndPersistProfileAnalysis(studentProfile.id, {
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
  revalidateTag(`profile-summary-${session.user.id}`)

  // Client component zaten window.location.href ile yönlendiriyor,
  // burada redirect() çağırmıyoruz — server action'dan programatik
  // çağrılınca NEXT_REDIRECT, client catch bloğu tarafından Error: aborted
  // olarak yakalanıp yanlış alert gösteriyordu.
}
