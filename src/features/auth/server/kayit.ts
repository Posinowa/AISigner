import "server-only";
import { prisma } from "@/lib/auth/prisma";

/** E-posta adresi zaten kayıtlı mı? */
export async function emailKayitliMi(email: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({ where: { email } });
  return existing !== null;
}

/**
 * Yeni kullanıcıyı oluşturur. Veri (rol, rıza alanları dahil) çağıran tarafından
 * kurulur; bu fonksiyon yalnız yazar.
 */
export async function kullaniciOlustur(
  veri: Parameters<typeof prisma.user.create>[0]["data"],
) {
  return prisma.user.create({
    data: veri,
    select: { id: true, name: true },
  });
}
