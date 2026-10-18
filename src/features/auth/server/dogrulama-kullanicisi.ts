import "server-only";
import { prisma } from "@/lib/db";

/** Doğrulama e-postası göndermek için gereken kullanıcı alanları. */
export async function dogrulamaKullanicisiniGetir(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
}
