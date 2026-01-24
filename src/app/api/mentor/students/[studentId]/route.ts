
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth"
import { getStudentDetail } from "@/features/mentors/server/actions";

export async function GET(
  req: Request,
  { params }: { params:Promise< { studentId: string } >}
) {
  try {
    // Session’dan mentor bilgisi al
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "MENTOR") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const mentorId = session.user.id; // 🔑 artık gerçek mentor ID
    const { studentId } = await params;

    // ensure studentId is provided and mentorId is present (narrows types)
   
    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    if (!mentorId) {
      return NextResponse.json(
        { error: "Mentor ID missing in session" },
        { status: 401 }
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
    console.error("GET /api/mentor/students/[studentId] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch student detail" },
      { status: 500 }
    );
  }
}