import { NextResponse } from "next/server";
import { getAllUsers, updateUserRole, assignMentor } from "@/features/admin/server/user";
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

  const updated = await assignMentor(parsed.data.studentId, parsed.data.mentorId);
  return NextResponse.json(updated);
}
