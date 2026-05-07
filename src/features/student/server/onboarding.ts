"use server"

import { revalidateTag } from "next/cache"
import { z } from "zod"
import { personalSchema, experienceSchema, goalsSchema } from "../models/onboarding"
import { prisma } from "@/lib/auth/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/nextauth"

// Tek birleşik şema
const onboardingSchema = z.object({
  personal: personalSchema,
  experience: experienceSchema,
  goals: goalsSchema,
  
})

export async function saveOnboarding(rawData: unknown) {
  // 1. Kullanıcı doğrulama
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

  // 3. User + StudentProfile'ı atomik güncelle (firstName/lastName/phone User'da, profil alanları StudentProfile'da)
  await prisma.$transaction([
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
        experienceLevel: data.experience.level,
        interests: data.experience.interest,
        goals: data.goals.goal,
        availability: data.goals.availability,
        birthYear: data.personal.birthYear,
      },
      create: {
        userId: session.user.id,
        experienceLevel: data.experience.level,
        interests: data.experience.interest,
        goals: data.goals.goal,
        availability: data.goals.availability,
        birthYear: data.personal.birthYear,
      },
    }),
  ])

  // 4. Profil değişti → AI özet cache'ini invalidate et
  revalidateTag(`profile-summary-${session.user.id}`)

  // Client component zaten window.location.href ile yönlendiriyor,
  // burada redirect() çağırmıyoruz — server action'dan programatik
  // çağrılınca NEXT_REDIRECT, client catch bloğu tarafından Error: aborted
  // olarak yakalanıp yanlış alert gösteriyordu.
}
