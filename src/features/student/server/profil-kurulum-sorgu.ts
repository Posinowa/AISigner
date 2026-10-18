import "server-only";
import { prisma } from "@/lib/db";

/** Profil kurulum sayfası: kullanıcının ad, soyad ve telefonu. */
export async function profilKurulumKullanicisiniGetir(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, lastName: true, phone: true },
  });
}

/** Profil kurulum sayfası: öğrenci profilinin önceden doldurulan alanları. */
export async function profilKurulumOgrenciProfiliniGetir(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      birthYear: true,
      experienceLevel: true,
      interests: true,
      goals: true,
      availability: true,
      // #289: Genişletilen sorular da prefill edilmeli — yoksa profilini
      // tekrar açan stajyer bunları BOŞ görüp baştan doldurur.
      city: true,
      gitLevel: true,
      weeklyHours: true,
      school: true,
      department: true,
      classYear: true,
      englishLevel: true,
    },
  });
}
