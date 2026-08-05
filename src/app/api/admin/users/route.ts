import { NextResponse } from "next/server";
import { getAllUsers, updateUserRole, setStudentMentors, AssignmentValidationError } from "@/features/admin/server/user";
import { requireAuth } from "@/lib/auth/guard";
import { updateRoleSchema, assignMentorSchema } from "@/lib/validations/api";

export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const users = await getAllUsers();
  return NextResponse.json(users);
}

export async function PATCH(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Admin kendi rolünü değiştiremez — panel erişimini kaybeder
  if (parsed.data.userId === auth.session.user.id) {
    return NextResponse.json(
      { error: "Kendi rolünüzü değiştiremezsiniz." },
      { status: 403 }
    );
  }

  const updated = await updateUserRole(parsed.data.userId, parsed.data.role);
  return NextResponse.json(updated);
}

export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const parsed = assignMentorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const updated = await setStudentMentors(parsed.data.studentId, parsed.data.mentorIds);
    return NextResponse.json(updated);
  } catch (error) {
    // #43: Geçersiz rol → 400 (anlamlı mesaj). Diğer hatalar → 500.
    if (error instanceof AssignmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/admin/users assignMentor error:", error);
    return NextResponse.json(
      { error: "Mentor atama sırasında bir hata oluştu." },
      { status: 500 },
    );
  }
}
