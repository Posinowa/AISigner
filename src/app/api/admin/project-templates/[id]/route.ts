// src/app/api/admin/project-templates/[id]/route.ts
import { NextResponse } from "next/server";
import {
  updateTemplate,
  deleteTemplate,
  getTemplateById,
} from "@/features/projects/server/templates";
import { requireAuth } from "@/lib/auth/guard";
import { updateTemplateSchema } from "@/lib/validations/api";
import { sablonuYonetebilir } from "@/features/projects/yetki";


/**
 * #253: Mentörler de şablon oluşturabildiği için düzenleme/silme artık
 * SAHİPLİĞE bağlı. Admin hepsini yönetir; mentör yalnızca kendi
 * oluşturduğunu. Sahipsiz (eski) şablonlar mentöre kapalı.
 *
 * Var olmayan şablon ile yetkisiz şablon AYNI yanıtı vermiyor: bu uç zaten
 * yalnızca ADMIN/MENTOR'e açık, yani id varlığı sızdırmak bir dış saldırgana
 * bilgi kazandırmıyor; buna karşılık mentöre "yok" demek yanıltıcı olurdu.
 */
async function yetkiliSablon(
  id: string,
  kullanici: { id?: string | null; role?: string | null },
) {
  const sablon = await getTemplateById(id);
  if (!sablon) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Proje şablonu bulunamadı." },
        { status: 404 },
      ),
    };
  }

  if (!sablonuYonetebilir(kullanici, sablon)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Yalnızca kendi oluşturduğunuz şablonu düzenleyebilirsiniz." },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, sablon };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN", "MENTOR"]);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;

    const yetki = await yetkiliSablon(id, auth.session.user);
    if (!yetki.ok) return yetki.response;

    const body = await req.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const updated = await updateTemplate(id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    // #112: Title güncellemesi mevcut bir şablonla çakışırsa → 409
    if ((error as { code?: string })?.code === "DUPLICATE_TITLE") {
      return NextResponse.json(
        { error: "Bu başlıkta bir proje şablonu zaten var." },
        { status: 409 }
      );
    }
    console.error("PATCH /api/admin/project-templates/[id] error:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["ADMIN", "MENTOR"]);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;

    const yetki = await yetkiliSablon(id, auth.session.user);
    if (!yetki.ok) return yetki.response;

    await deleteTemplate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/project-templates/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
