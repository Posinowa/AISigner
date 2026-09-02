import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ATAMA_SAHIPLIK_SELECT,
  mentoruMu,
} from "@/features/teams/server/sahiplik";
import { requireAuth } from "@/lib/auth/guard";
import { updateRoadmapSchema } from "@/lib/validations/api";

// GET: Roadmap detayını getir
export async function GET(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const { roadmapId } = await params;

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        steps: { orderBy: { order: "asc" } },
        // #332: Sahiplik bireysel VEYA takım; yetki tek tanımdan gelir.
        assignedProject: {
          select: {
            ...ATAMA_SAHIPLIK_SELECT,
            projectTemplate: true,
            studentProfile: {
              include: {
                user: { select: { name: true, lastName: true, email: true } },
                mentorAssignments: { select: { mentorId: true } },
              },
            },
          },
        },
      },
    });

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
    console.error("Roadmap GET Error:", error);
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
    const existingRoadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        assignedProject: {
          include: {
            // #332: Sahiplik bireysel VEYA takım.
            ...ATAMA_SAHIPLIK_SELECT,
          },
        },
      },
    });

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

    const updateData: Record<string, string> = {};
    if (parsed.data.title) updateData.title = parsed.data.title;
    if (parsed.data.status) updateData.status = parsed.data.status;

    const roadmap = await prisma.roadmap.update({
      where: { id: roadmapId },
      data: updateData,
      include: {
        steps: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(roadmap);
  } catch (error) {
    console.error("Roadmap PUT Error:", error);
    return NextResponse.json(
      { error: "Yol haritası güncellenirken hata oluştu." },
      { status: 500 }
    );
  }
}
