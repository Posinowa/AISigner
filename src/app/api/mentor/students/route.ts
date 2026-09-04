import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getMentorStudents } from "@/features/mentors/server/actions";
import { rotaHatasi } from "@/lib/api-hata";

export async function GET() {
  try {
    const auth = await requireAuth("MENTOR");
    if (!auth.authorized) return auth.response;

    const mentorId = auth.session.user.id!;
    const students = await getMentorStudents(mentorId);

    return NextResponse.json(students);
  } catch (error) {
    rotaHatasi("GET /api/mentor/students error:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}