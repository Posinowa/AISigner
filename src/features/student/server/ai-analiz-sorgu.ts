import "server-only";
import { prisma } from "@/lib/db";

/** Öğrenci AI analiz sayfası: profil alanları. */
export async function aiAnalizProfiliniGetir(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      experienceLevel: true,
      interests: true,
      goals: true,
      availability: true,
    },
  });
}
