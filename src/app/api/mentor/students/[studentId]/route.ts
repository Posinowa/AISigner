
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getStudentDetail } from "@/features/mentors/server/actions";
import { rotaHatasi } from "@/lib/api-hata";

export async function GET(
  req: Request,
  { params }: { params:Promise< { studentId: string } >}
) {
  try {
    const auth = await requireAuth("MENTOR");
    if (!auth.authorized) return auth.response;

    const mentorId = auth.session.user.id!;
    const { studentId } = await params;

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    const student = await getStudentDetail(studentId, mentorId);

    if (!student) {
      return NextResponse.json(
        { error: "Student not found or not assigned to you" },
        { status: 404 }
      );
    }

    return NextResponse.json(student);
  } catch (error) {
    rotaHatasi("GET /api/mentor/students/[studentId] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch student detail" },
      { status: 500 }
    );
  }
}