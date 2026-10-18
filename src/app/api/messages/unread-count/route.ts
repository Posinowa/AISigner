import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { rotaHatasi } from "@/lib/api-hata";
import { okunmamisMesajSayisi } from "@/features/messaging/server/mesajlar";

/**
 * GET /api/messages/unread-count
 * Toplam okunmamış mesaj sayısını döner (badge/bildirim için).
 */
export async function GET() {
  const auth = await requireAuth(["MENTOR", "STUDENT", "ADMIN"]);
  if (!auth.authorized) return auth.response;

  try {
    const count = await okunmamisMesajSayisi(auth.session.user.id!);

    return NextResponse.json({ unreadCount: count });
  } catch (error) {
    rotaHatasi("GET /api/messages/unread-count error:", error);
    return NextResponse.json(
      { error: "Okunmamış mesaj sayısı alınamadı." },
      { status: 500 }
    );
  }
}
