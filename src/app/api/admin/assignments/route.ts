import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getStudentAssignmentsProgress } from "@/features/admin/server/assignment-progress";
import {
  baslatGitHubWorkspaceKurulumu,
  KurulumZatenSuruyorError,
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
    //
    // PERFORMANS: uç artık işin BİTMESİNİ beklemiyor. Doğrulama ve yetki
    // kontrolü senkron yapılır (admin hatalı bir şey denediyse anında öğrenir),
    // asıl kurulum arka planda koşar. Öncesi adım başına AI + issue başına
    // GitHub çağrısını tek istekte bekliyordu ve platformun zaman aşımına
    // çarpabiliyordu. İlerleme `githubStatus` üzerinden izlenir.
    const result = await baslatGitHubWorkspaceKurulumu(assignmentId, guncelle === true);

    // 202 Accepted: "kabul edildi, henüz tamamlanmadı".
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    // Sürmekte olan bir kurulum "sunucu hatası" değildir: istek geçerli, durum
    // uygun değil. 409 ile ayrıştırıyoruz ki istemci bunu gerçek bir arızadan
    // ayırt edebilsin (ve hata izleme sisteminde gürültü yapmasın).
    if (error instanceof KurulumZatenSuruyorError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("POST /api/admin/assignments error:", error);
    const message = error instanceof Error ? error.message : "GitHub workspace oluşturulurken hata oluştu";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
