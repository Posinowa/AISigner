import { NextResponse } from "next/server";
import { updateSuggestion } from "@/features/suggestions/server/suggestions";
import { requireAuth } from "@/lib/auth/guard";
import { updateSuggestionSchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * PATCH /api/admin/suggestions/[id]
 * Öneri/isteğin durumunu veya yönetici notunu günceller (#147).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSuggestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // guard `session.user.id` varlığını doğruladı.
    const updated = await updateSuggestion(id, parsed.data, auth.session.user.id!);
    if (!updated) {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    rotaHatasi("PATCH /api/admin/suggestions/[id] error:", error);
    return NextResponse.json(
      { error: "Kayıt güncellenirken hata oluştu." },
      { status: 500 },
    );
  }
}
