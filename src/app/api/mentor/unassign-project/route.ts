import { NextResponse } from "next/server";
import { unassignProject } from "@/features/mentors/server/actions";
import { requireAuth } from "@/lib/auth/guard";
import { unassignProjectSchema } from "@/lib/validations/api";

export async function DELETE(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = unassignProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    await unassignProject(parsed.data.assignedProjectId, auth.session.user.id!);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unassign error:", error);
    return NextResponse.json({ error: "Silme işlemi başarısız" }, { status: 500 });
  }
}