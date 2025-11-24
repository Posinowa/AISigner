"use server"

import { redirect } from "next/navigation"
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

  // 3. DB kaydetme (idempotent update)
  await prisma.studentProfile.upsert({
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
  })

  // 4. Başarılı işlem → redirect
  redirect("/student-dashboard")
}
