import "server-only";
import { prisma } from "@/lib/db";

/** Kullanıcı kimliğiyle öğrenci profilinin kimliği (profil yoksa null). */
export async function ogrenciProfiliniGetir(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
}
