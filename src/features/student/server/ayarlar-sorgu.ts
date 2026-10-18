import "server-only";
import { prisma } from "@/lib/db";

/** Öğrenci ayarlar sayfası: takılma bildirimi tercihi. */
export async function ayarlarProfiliniGetir(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: { takilmaBildirimi: true },
  });
}
