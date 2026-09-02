import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { bekleyenOneriler } from "@/features/proposals/server/oneri";

/** Bekleyen proje önerileri kuyruğu (#366). */
export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    return NextResponse.json({ oneriler: await bekleyenOneriler() });
  } catch (error) {
    console.error("GET /api/admin/proposals error:", error);
    return NextResponse.json({ error: "Öneriler yüklenemedi." }, { status: 500 });
  }
}
