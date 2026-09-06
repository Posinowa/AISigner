import { NextResponse } from "next/server";
import { listAllSuggestions } from "@/features/suggestions/server/suggestions";
import { requireAuth } from "@/lib/auth/guard";
import { listSuggestionsQuerySchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * GET /api/admin/suggestions?status=OPEN&cursor=<id>&limit=<n>
 * Tüm öneri/istekleri sayfalanmış listeler (admin) — #147, #163.
 */
export async function GET(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const parsed = listSuggestionsQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const page = await listAllSuggestions(parsed.data);
    return NextResponse.json(page);
  } catch (error) {
    rotaHatasi("GET /api/admin/suggestions error:", error);
    return NextResponse.json(
      { error: "Öneriler yüklenirken hata oluştu." },
      { status: 500 },
    );
  }
}
