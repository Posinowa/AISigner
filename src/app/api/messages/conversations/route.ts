import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/messages/conversations
 * Kullanıcının tüm konuşma listesini döner (her konuşma partneri + son mesaj + okunmamış sayısı).
 */
export async function GET() {
  const auth = await requireAuth(["MENTOR", "STUDENT", "ADMIN"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;

  try {
    const userRole = auth.session.user.role;
    let conversationPartners: { id: string; name: string | null; lastName: string | null; role: string }[] = [];

    if (userRole === "ADMIN") {
      // Admin: tüm kullanıcılar (kendisi hariç)
      const users = await prisma.user.findMany({
        where: { id: { not: userId } },
        select: { id: true, name: true, lastName: true, role: true },
        orderBy: { createdAt: "desc" },
      });
      conversationPartners = users;
    } else if (userRole === "MENTOR") {
      const profiles = await prisma.studentProfile.findMany({
        where: { mentorId: userId },
        include: {
          user: {
            select: { id: true, name: true, lastName: true, role: true },
          },
        },
      });
      conversationPartners = profiles.map((p) => p.user);

      // ADMIN'lerle de mesajlaşabilir
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true, name: true, lastName: true, role: true },
      });
      conversationPartners = [...conversationPartners, ...admins];
    } else if (userRole === "STUDENT") {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId },
        include: {
          mentor: {
            select: { id: true, name: true, lastName: true, role: true },
          },
        },
      });
      if (profile?.mentor) {
        conversationPartners = [profile.mentor];
      }

      // ADMIN'lerle de mesajlaşabilir
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true, name: true, lastName: true, role: true },
      });
      conversationPartners = [...conversationPartners, ...admins];
    }

    // Her partner için son mesaj ve okunmamış sayısı
    const conversations = await Promise.all(
      conversationPartners.map(async (partner) => {
        const [lastMessage, unreadCount] = await Promise.all([
          prisma.message.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: partner.id },
                { senderId: partner.id, receiverId: userId },
              ],
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              content: true,
              senderId: true,
              createdAt: true,
              isRead: true,
            },
          }),
          prisma.message.count({
            where: {
              senderId: partner.id,
              receiverId: userId,
              isRead: false,
            },
          }),
        ]);

        return {
          partner,
          lastMessage,
          unreadCount,
        };
      })
    );

    // Son mesaja göre sırala (en son mesajı olan en üstte)
    conversations.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("GET /api/messages/conversations error:", error);
    return NextResponse.json(
      { error: "Konuşmalar yüklenirken hata oluştu." },
      { status: 500 }
    );
  }
}
