import "server-only";
import { prisma } from "@/lib/db";

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

  // #195: M:N — karşı taraf, benim (mentör) öğrencilerimden biri mi?
  const asMentor = await prisma.studentProfile.findFirst({
    where: { userId: otherUserId, mentorAssignments: { some: { mentorId: userId } } },
    select: { id: true },
  });
  if (asMentor) return true;

  // #195: M:N — karşı taraf, benim (öğrenci) mentorlarımdan biri mi?
  const asStudent = await prisma.studentProfile.findFirst({
    where: { userId, mentorAssignments: { some: { mentorId: otherUserId } } },
    select: { id: true },
  });
  if (asStudent) return true;

  return false;
}
