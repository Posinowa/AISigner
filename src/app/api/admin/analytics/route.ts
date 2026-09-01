import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { panelVerisiGetir } from "@/features/analytics/server/panel";

/**
 * Platform geneli analitik (#331).
 *
 * Kapsam DARALTILMADAN çağrılıyor — bu ucun ADMIN'e kapalı olması, verinin
 * tüm platformu kapsamasının tek koruması.
 */
export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    return NextResponse.json(await panelVerisiGetir());
  } catch (error) {
    console.error("GET /api/admin/analytics error:", error);
    return NextResponse.json({ error: "Analitik veriler yüklenemedi." }, { status: 500 });
  }
}
