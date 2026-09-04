import { rotaHatasi } from "@/lib/api-hata";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getStudentAssignmentsProgress } from "@/features/admin/server/assignment-progress";
import {
  baslatGitHubWorkspaceKurulumu,
  KurulumZatenSuruyorError,
} from "@/features/github/server/provisioning";

const GECERLI_DURUMLAR = ["ALL", "PROVISIONED", "NOT_PROVISIONED"] as const;

export async function GET(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    // #452: Süzme ve sayfalama sunucuda. Öncesinde uç TÜM atamaları
    // döndürüyordu (1406 atamada 1.04 MB) ve filtreler istemcideydi.
    const sp = new URL(req.url).searchParams;
    const durum = sp.get("durum");
    const limitHam = Number(sp.get("limit"));

    const data = await getStudentAssignmentsProgress({
      // Tanınmayan değer sessizce "ALL"a düşer — istemciden gelen bir
      // yazım hatası listeyi boşaltmamalı.
      githubDurum: GECERLI_DURUMLAR.includes(durum as (typeof GECERLI_DURUMLAR)[number])
        ? (durum as (typeof GECERLI_DURUMLAR)[number])
        : "ALL",
      mentorId: sp.get("mentor") || null,
      cursor: sp.get("cursor") || null,
      ...(Number.isFinite(limitHam) && limitHam > 0 ? { limit: limitHam } : {}),
    });
    return NextResponse.json(data);
  } catch (error) {
    rotaHatasi("GET /api/admin/assignments error:", error);
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
    rotaHatasi("POST /api/admin/assignments error:", error);
    const message = error instanceof Error ? error.message : "GitHub workspace oluşturulurken hata oluştu";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
