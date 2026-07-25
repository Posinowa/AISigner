import { NextResponse } from "next/server";
import { listAllSuggestions } from "@/features/suggestions/server/suggestions";
import { requireAuth } from "@/lib/auth/guard";
import { suggestionStatusEnum } from "@/lib/validations/api";

/**
 * GET /api/admin/suggestions?status=OPEN
 * Tüm öneri/istekleri listeler (admin) — #147.
 */
export async function GET(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const raw = new URL(req.url).searchParams.get("status");
    const parsed = raw ? suggestionStatusEnum.safeParse(raw) : null;
    if (parsed && !parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz durum filtresi." },
        { status: 400 },
      );
    }

    const items = await listAllSuggestions(parsed?.data);
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/admin/suggestions error:", error);
    return NextResponse.json(
      { error: "Öneriler yüklenirken hata oluştu." },
      { status: 500 },
    );
  }
}
