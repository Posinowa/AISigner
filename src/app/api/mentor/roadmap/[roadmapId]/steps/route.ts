import { NextResponse } from "next/server";
import { mentoruMu } from "@/features/teams/server/sahiplik";
import { sonaAdimEkle, yolHaritasiSahipligi } from "@/features/roadmap/server/adim-yazma";
import { requireAuth } from "@/lib/auth/guard";
import { createStepSchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

// POST: Roadmap'e yeni adım ekle
export async function POST(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const { roadmapId } = await params;

    // Mentor ownership kontrolü
    const roadmap = await yolHaritasiSahipligi(roadmapId);

    if (!roadmap) {
      return NextResponse.json({ error: "Yol haritası bulunamadı!" }, { status: 404 });
    }

    // #195: öğrencinin mentorlarından biri mi?
    if (!mentoruMu(roadmap.assignedProject, auth.session.user.id)) {
      return NextResponse.json(
        { error: "Bu yol haritasına adım ekleme yetkiniz yok." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Yeni adım, mevcut en yüksek sıranın bir sonrasına yazılır.
    const step = await sonaAdimEkle(roadmapId, {
      title: parsed.data.title,
      description: parsed.data.description,
      estimatedHours: parsed.data.estimatedHours || null,
      resources: parsed.data.resources || [],
      githubIssueUrl: parsed.data.githubIssueUrl || null,
    });

    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    rotaHatasi("Step POST Error:", error);
    return NextResponse.json(
      { error: "Adım eklenirken hata oluştu." },
      { status: 500 }
    );
  }
}
