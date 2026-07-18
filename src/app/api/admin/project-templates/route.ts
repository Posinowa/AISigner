// src/app/api/admin/project-templates/route.ts
import { NextResponse } from "next/server";
import { listTemplates, createTemplate } from "@/features/projects/server/templates";
import { requireAuth } from "@/lib/auth/guard";
import { createTemplateSchema } from "@/lib/validations/api";

export async function GET() {
  const auth = await requireAuth(["ADMIN", "MENTOR"]);
  if (!auth.authorized) return auth.response;

  try {
    const templates = await listTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/admin/project-templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newTemplate = await createTemplate(parsed.data);
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    // #112: Aynı title ile ikinci şablon → 409 (500 değil)
    if ((error as { code?: string })?.code === "DUPLICATE_TITLE") {
      return NextResponse.json(
        { error: "Bu başlıkta bir proje şablonu zaten var." },
        { status: 409 }
      );
    }
    console.error("POST /api/admin/project-templates error:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}