import { NextResponse } from "next/server";
import { assignProjectToStudent } from "@/features/mentors/server/actions";
import { requireAuth } from "@/lib/auth/guard";
import { assignProjectSchema } from "@/lib/validations/api";

export async function POST(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = assignProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await assignProjectToStudent(
      parsed.data.studentProfileId,
      parsed.data.projectTemplateId,
      auth.session.user.id!
    );

    return NextResponse.json(result, { status: 201 });

  } catch (error: unknown) {
    console.error("Proje atama hatası:", error);
    return NextResponse.json(
      { error: "Proje atanırken bir hata oluştu." },
      { status: 500 }
    );
  }
}