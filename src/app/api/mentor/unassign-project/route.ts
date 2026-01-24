import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { unassignProject } from "@/features/mentors/server/actions";

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Mentor yetki kontrolü
    if (!session || session.user.role !== "MENTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Body'den ID'yi al
    const { assignedProjectId } = await req.json();

    if (!assignedProjectId) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }

    await unassignProject(assignedProjectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unassign error:", error);
    return NextResponse.json({ error: "Silme işlemi başarısız" }, { status: 500 });
  }
}