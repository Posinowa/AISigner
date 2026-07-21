import { NextResponse } from "next/server";
import {
  createSuggestion,
  listOwnSuggestions,
} from "@/features/suggestions/server/suggestions";
import { requireAuth } from "@/lib/auth/guard";
import { createSuggestionSchema } from "@/lib/validations/api";

/**
 * GET /api/suggestions
 * Oturum sahibinin kendi öneri/istek geçmişi (#147).
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  try {
    // guard `session.user.id` varlığını doğruladı.
    const items = await listOwnSuggestions(auth.session.user.id!);
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/suggestions error:", error);
    return NextResponse.json(
      { error: "Öneriler yüklenirken hata oluştu." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/suggestions
 * Yeni öneri/istek oluşturur. Yazar her zaman oturumdan alınır — istemci
 * başkası adına kayıt açamaz (#147).
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = createSuggestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const created = await createSuggestion({
      authorId: auth.session.user.id!,
      ...parsed.data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/suggestions error:", error);
    return NextResponse.json(
      { error: "Öneri gönderilirken hata oluştu." },
      { status: 500 },
    );
  }
}
