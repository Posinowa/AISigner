import "server-only";
import { prisma } from "@/lib/db";
import { mentorunOgrencisiWhere } from "@/features/teams/server/sahiplik";

/**
 * Konuşma erişim kontrolü.
 *
 * `/api/messages` içindeydi; #354 ile ORTAK bir modüle çıkarıldı çünkü
 * "yazıyor..." sinyali AYNI kuralı kullanmak zorunda. İki yerde ayrı ayrı
 * yazılsaydı biri güncellenip diğeri unutulduğunda, mesaj gönderemediği
 * birine yazdığını sızdıran bir uç kalırdı.
 *
 * - ADMIN: herkesle mesajlaşabilir (karşı taraf var olmalı).
 * - MENTOR/STUDENT: yalnızca birbirine atanmış çiftler.
 *
 * ⚠️ BAĞ İKİ YOLDAN GELİR (#370). #332 ile mentör TAKIMA da atanabiliyor ve
 * takım üyeleriyle arasında bireysel bir `MentorAssignment` kaydı YOK. Yalnız
 * bireysel bağa bakan sürüm, takım mentörü ile üyesinin birbirine mesaj
 * göndermesini 403 ile engelliyordu — takım özelliğinin en temel iletişim
 * kanalı kapalıydı. Kural artık `mentorunOgrencisiWhere` içinde tek noktada.
 */
export async function verifyConversationAccess(
  userId: string,
  otherUserId: string,
  userRole?: string,
): Promise<boolean> {
  // Kendine mesaj/sinyal yok.
  if (userId === otherUserId) return false;

  if (userRole === "ADMIN") {
    const exists = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    });
    return !!exists;
  }

  // Karşı taraf ADMIN ise (admin → user mesajına yanıt) izin ver.
  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { role: true },
  });
  if (other?.role === "ADMIN") return true;

  // Karşı taraf, öğrencilerimden biri mi? (ben mentörüm)
  const ogrencim = await prisma.studentProfile.findFirst({
    where: { userId: otherUserId, ...mentorunOgrencisiWhere(userId) },
    select: { id: true },
  });
  if (ogrencim) return true;

  // Karşı taraf, mentörlerimden biri mi? (ben öğrenciyim)
  const mentorum = await prisma.studentProfile.findFirst({
    where: { userId, ...mentorunOgrencisiWhere(otherUserId) },
    select: { id: true },
  });
  if (mentorum) return true;

  return false;
}
