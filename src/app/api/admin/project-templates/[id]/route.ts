// src/app/api/admin/project-templates/[id]/route.ts
import { NextResponse } from "next/server";
import { updateTemplate, deleteTemplate } from "@/features/projects/server/templates";
import { requireAuth } from "@/lib/auth/guard";
import { updateTemplateSchema } from "@/lib/validations/api";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
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
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await deleteTemplate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/project-templates/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
