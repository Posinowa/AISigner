import "server-only";
import { prisma } from "@/lib/db";

/** Öğrencinin takılma bildirimi tercihini yazar. Etkilenen satır sayısını döner (0: profil yok). */
export async function takilmaBildiriminiYaz(userId: string, acik: boolean): Promise<number> {
  const { count } = await prisma.studentProfile.updateMany({
    where: { userId },
    data: { takilmaBildirimi: acik },
  });
  return count;
}
