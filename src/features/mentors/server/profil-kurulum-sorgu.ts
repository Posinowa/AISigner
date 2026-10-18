import "server-only";
import { prisma } from "@/lib/db";

/** Mentör profil kurulum sayfası: mevcut mentör başvurusu (önceden doldurma). */
export async function mentorProfilKurulumKaydiniGetir(userId: string) {
  return prisma.mentorProfile.findUnique({
    where: { userId },
    select: {
      title: true,
      company: true,
      yearsExperience: true,
      seniority: true,
      expertise: true,
      capacity: true,
      weeklyHours: true,
      motivation: true,
      mentoringStyle: true,
      githubUrl: true,
      linkedinUrl: true,
      city: true,
    },
  });
}
