import "server-only";
import { prisma } from "@/lib/db";

/** Hesap durumu sayfası: öğrenci profilinin varlığı (kimlik yeterli). */
export async function ogrenciProfilKaydiniGetir(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
}

/** Hesap durumu sayfası: mentör profilinin varlığı (kimlik yeterli). */
export async function mentorProfilKaydiniGetir(userId: string) {
  return prisma.mentorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
}
