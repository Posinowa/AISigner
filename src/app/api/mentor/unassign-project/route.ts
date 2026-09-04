import { NextResponse } from "next/server";
import { unassignProject } from "@/features/mentors/server/actions";
import { requireAuth } from "@/lib/auth/guard";
import { unassignProjectSchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

export async function DELETE(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = unassignProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const force = (parsed.data as { force?: boolean }).force === true;
    await unassignProject(parsed.data.assignedProjectId, auth.session.user.id!, force);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === "REQUIRES_CONFIRMATION") {
      return NextResponse.json(
        { error: error.message, requiresConfirmation: true },
        { status: 409 }
      );
    }
    rotaHatasi("Unassign error:", error);
    return NextResponse.json({ error: "Silme işlemi başarısız" }, { status: 500 });
  }
}