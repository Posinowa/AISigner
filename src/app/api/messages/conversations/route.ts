import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { rotaHatasi } from "@/lib/api-hata";
import { konusmaOzetleri, konusmaPartnerleri } from "@/features/messaging/server/konusmalar";

/**
 * GET /api/messages/conversations
 * Kullanıcının tüm konuşma listesini döner (her konuşma partneri + son mesaj + okunmamış sayısı).
 */
export async function GET() {
  const auth = await requireAuth(["MENTOR", "STUDENT", "ADMIN"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;

  try {
    const partnerler = await konusmaPartnerleri(userId, auth.session.user.role);
    const conversations = await konusmaOzetleri(userId, partnerler);

    return NextResponse.json({ conversations });
  } catch (error) {
    rotaHatasi("GET /api/messages/conversations error:", error);
    return NextResponse.json(
      { error: "Konuşmalar yüklenirken hata oluştu." },
      { status: 500 }
    );
  }
}
