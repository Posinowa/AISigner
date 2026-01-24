// src/app/api/admin/project-templates/[id]/route.ts
import { NextResponse } from "next/server";
import { updateTemplate, deleteTemplate } from "@/features/projects/server/templates";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await updateTemplate(params.id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/project-templates/[id] error:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deleteTemplate(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/project-templates/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
