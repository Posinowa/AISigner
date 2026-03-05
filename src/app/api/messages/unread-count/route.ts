import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/messages/unread-count
 * Toplam okunmamış mesaj sayısını döner (badge/bildirim için).
 */
export async function GET() {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  try {
    const count = await prisma.message.count({
      where: {
        receiverId: auth.session.user.id!,
        isRead: false,
      },
    });

    return NextResponse.json({ unreadCount: count });
  } catch (error) {
    console.error("GET /api/messages/unread-count error:", error);
    return NextResponse.json(
      { error: "Okunmamış mesaj sayısı alınamadı." },
      { status: 500 }
    );
  }
}
