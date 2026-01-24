// src/app/api/admin/project-templates/route.ts
import { NextResponse } from "next/server";
import { listTemplates, createTemplate } from "@/features/projects/server/templates";

export async function GET() {
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
  try {
    const body = await req.json();
    
    // Validation
    if (!body.title || !body.description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    if (!["EASY", "MEDIUM", "HARD"].includes(body.difficulty)) {
      return NextResponse.json(
        { error: "Invalid difficulty level" },
        { status: 400 }
      );
    }

    const templateData = {
      title: body.title,
      description: body.description,
      difficulty: body.difficulty,
      track: Array.isArray(body.track) ? body.track : [],
    };

    const newTemplate = await createTemplate(templateData);
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/project-templates error:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}