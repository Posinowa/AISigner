import { NextResponse } from "next/server";
import { mentoruMu } from "@/features/teams/server/sahiplik";
import {
  yolHaritasiDetayi,
  yolHaritasiGuncelle,
  yolHaritasiSahipligi,
} from "@/features/roadmap/server/adim-yazma";
import { requireAuth } from "@/lib/auth/guard";
import { updateRoadmapSchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

// GET: Roadmap detayını getir
export async function GET(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const { roadmapId } = await params;

    const roadmap = await yolHaritasiDetayi(roadmapId);

    if (!roadmap) {
      return NextResponse.json(
        { error: "Yol haritası bulunamadı!" },
        { status: 404 }
      );
    }

    // Mentor ownership kontrolü — #195: öğrencinin mentorlarından biri mi?
    if (!mentoruMu(roadmap.assignedProject, auth.session.user.id)) {
      return NextResponse.json(
        { error: "Bu yol haritasına erişim yetkiniz yok." },
        { status: 403 }
      );
    }

    return NextResponse.json(roadmap);
  } catch (error) {
    rotaHatasi("Roadmap GET Error:", error);
    return NextResponse.json(
      { error: "Yol haritası getirilirken hata oluştu." },
      { status: 500 }
    );
  }
}

// PUT: Roadmap'i güncelle (başlık, durum)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const { roadmapId } = await params;
    const body = await req.json();
    const parsed = updateRoadmapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Mentor ownership kontrolü
    const existingRoadmap = await yolHaritasiSahipligi(roadmapId);

    if (!existingRoadmap) {
      return NextResponse.json({ error: "Yol haritası bulunamadı!" }, { status: 404 });
    }

    // #195: öğrencinin mentorlarından biri mi?
    if (!mentoruMu(existingRoadmap.assignedProject, auth.session.user.id)) {
      return NextResponse.json(
        { error: "Bu yol haritasını güncelleme yetkiniz yok." },
        { status: 403 }
      );
    }

    const roadmap = await yolHaritasiGuncelle(roadmapId, {
      title: parsed.data.title,
      status: parsed.data.status,
    });

    return NextResponse.json(roadmap);
  } catch (error) {
    rotaHatasi("Roadmap PUT Error:", error);
    return NextResponse.json(
      { error: "Yol haritası güncellenirken hata oluştu." },
      { status: 500 }
    );
  }
}
