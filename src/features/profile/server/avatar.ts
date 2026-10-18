import "server-only";
import { prisma } from "@/lib/db";

/**
 * Kullanıcı avatar kaydının veri erişimi (`/api/profile/avatar`, `/api/users/[userId]/avatar`).
 *
 * Dosyanın depolanması `@/lib/storage/avatars` üzerindedir; bu modül yalnız
 * `User.avatarFile` alanını okur ve yazar.
 */

/** Kullanıcının kayıtlı avatar dosya adı (yoksa null). */
export async function avatarDosyasiniGetir(userId: string): Promise<string | null> {
  const kullanici = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarFile: true },
  });
  return kullanici?.avatarFile ?? null;
}

/** Avatar dosya adını yazar; null ise avatarı kaldırır. */
export async function avatarDosyasiniAyarla(userId: string, avatarFile: string | null) {
  await prisma.user.update({
    where: { id: userId },
    data: { avatarFile },
  });
}
