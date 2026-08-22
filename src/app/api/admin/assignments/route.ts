import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getStudentAssignmentsProgress } from "@/features/admin/server/assignment-progress";
import {
  provisionGitHubWorkspace,
  updateGitHubWorkspace,
} from "@/features/github/server/provisioning";

export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const data = await getStudentAssignmentsProgress();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/admin/assignments error:", error);
    return NextResponse.json(
      { error: "Öğrenci ilerleme verileri yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { assignmentId, guncelle } = body;

    if (!assignmentId || typeof assignmentId !== "string") {
      return NextResponse.json(
        { error: "Geçersiz atama ID'si" },
        { status: 400 }
      );
    }

    // #257: Aynı uç hem ilk kurulumu hem güncellemeyi yapıyor. Ayrım açıkça
    // gövdeden geliyor; kurulu bir çalışma alanına kazayla "ilk kurulum"
    // muamelesi yapılmasın.
    const result =
      guncelle === true
        ? await updateGitHubWorkspace(assignmentId)
        : await provisionGitHubWorkspace(assignmentId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/admin/assignments error:", error);
    const message = error instanceof Error ? error.message : "GitHub workspace oluşturulurken hata oluştu";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
