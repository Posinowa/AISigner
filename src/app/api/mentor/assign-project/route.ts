import { NextResponse } from "next/server";
import { assignProjectToStudent, AssignmentConflictError } from "@/features/mentors/server/actions";
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
    // #58: Aynı proje-öğrenci çifti zaten varsa → 409 (kullanıcı dostu mesaj).
    if (error instanceof AssignmentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Proje atama hatası:", error);
    return NextResponse.json(
      { error: "Proje atanırken bir hata oluştu." },
      { status: 500 }
    );
  }
}