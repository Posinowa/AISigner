import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { uyeAyir } from "@/features/teams/server/takim";

/**
 * Üyeyi takımdan ayırır (#332 Faz 2).
 *
 * ⚠️ SİLME DEĞİL: üyelik satırı `leftAt` ile işaretlenir, katkı geçmişi durur.
 * Üyenin üstlendiği adımlar panoya geri düşer.
 */
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { teamId, memberId } = await params;

  try {
    const sonuc = await uyeAyir({ teamId, memberId });
    if (!sonuc.ok) {
      return NextResponse.json({ error: "Aktif üyelik bulunamadı." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/teams/[teamId]/members/[memberId] error:", error);
    return NextResponse.json({ error: "Üye ayrılamadı." }, { status: 500 });
  }
}
