import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { getMentorStudents } from "@/features/mentors/server/actions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Guard: ensure session and mentor id exist and role is MENTOR
    if (!session || session.user.role !== "MENTOR" || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mentorId = session.user.id; // now narrowed to string
    const students = await getMentorStudents(mentorId);

    return NextResponse.json(students);
  } catch (error) {
    console.error("GET /api/mentor/students error:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}