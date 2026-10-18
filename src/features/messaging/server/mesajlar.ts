import "server-only";
import { prisma } from "@/lib/db";

/**
 * Mesaj okuma/yazma sorguları (`/api/messages`, `/api/messages/unread-count`).
 *
 * Yetki kontrolü (`verifyConversationAccess`) route'ta kalır: route yanıtı
 * (403) ile karar verir. Bu modül yalnız veriyi taşır.
 */

const MESAJ_GONDEREN_SELECT = {
  sender: {
    select: { id: true, name: true, lastName: true, role: true },
  },
} as const;

/**
 * İki kişi arasındaki mesajları cursor ile sayfalar ve karşı tarafın
 * gönderdiği okunmamışları okundu işaretler.
 */
export async function konusmaMesajlariniGetir(params: {
  userId: string;
  conversationWith: string;
  cursor?: string;
  limit: number;
}) {
  const { userId, conversationWith, cursor, limit } = params;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: conversationWith },
        { senderId: conversationWith, receiverId: userId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: MESAJ_GONDEREN_SELECT,
  });

  const hasMore = messages.length > limit;
  const result = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? result[result.length - 1].id : null;

  // Okunan gelen mesajları okundu olarak işaretle
  await prisma.message.updateMany({
    where: {
      senderId: conversationWith,
      receiverId: userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return { messages: result, nextCursor, hasMore };
}

/** Yeni mesajı kaydeder ve gönderen bilgisiyle döner. */
export async function mesajGonder(params: {
  senderId: string;
  receiverId: string;
  content: string;
}) {
  return prisma.message.create({
    data: {
      senderId: params.senderId,
      receiverId: params.receiverId,
      content: params.content,
    },
    include: MESAJ_GONDEREN_SELECT,
  });
}

/** Kullanıcıya gelen okunmamış mesaj sayısı. */
export async function okunmamisMesajSayisi(userId: string): Promise<number> {
  return prisma.message.count({
    where: {
      receiverId: userId,
      isRead: false,
    },
  });
}
