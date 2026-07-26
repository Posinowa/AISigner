import { NextResponse } from "next/server";
import {
  createSuggestion,
  listOwnSuggestions,
} from "@/features/suggestions/server/suggestions";
import { requireAuth } from "@/lib/auth/guard";
import {
  createSuggestionSchema,
  listSuggestionsQuerySchema,
} from "@/lib/validations/api";
import { createRateLimiter } from "@/lib/rate-limit";

// #163 (P1): Kimliği doğrulanmış öğrenci sınırsız öneri gönderip yönetici gelen
// kutusunu spam'leyebiliyordu. ai-chat/forgot-password ile aynı desen.
const createLimiter = createRateLimiter("suggestions-create", {
  maxRequests: 10,
  windowSeconds: 3600, // saatte 10 öneri/istek
});

/**
 * GET /api/suggestions?cursor=<id>&limit=<n>
 * Oturum sahibinin kendi öneri/istek geçmişi, sayfalanmış (#147, #163).
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const parsedQuery = listSuggestionsQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: parsedQuery.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    // guard `session.user.id` varlığını doğruladı.
    const page = await listOwnSuggestions(auth.session.user.id!, parsedQuery.data);
    return NextResponse.json(page);
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

  // #163 (P1): Kötüye kullanım/spam koruması — kullanıcı bazlı.
  const rl = createLimiter.check(auth.session.user.id!);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla öneri gönderdiniz. Lütfen bir süre sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

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
