import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { createStepSchema } from "@/lib/validations/api";

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
    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        assignedProject: {
          include: { studentProfile: true },
        },
      },
    });

    if (!roadmap) {
      return NextResponse.json({ error: "Yol haritası bulunamadı!" }, { status: 404 });
    }

    if (roadmap.assignedProject.studentProfile.mentorId !== auth.session.user.id) {
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

    // Mevcut en yüksek sıra numarasını bul
    const lastStep = await prisma.roadmapStep.findFirst({
      where: { roadmapId },
      orderBy: { order: "desc" },
    });

    const newOrder = (lastStep?.order ?? 0) + 1;

    const step = await prisma.roadmapStep.create({
      data: {
        roadmapId,
        order: newOrder,
        title: parsed.data.title,
        description: parsed.data.description,
        estimatedHours: parsed.data.estimatedHours || null,
        resources: parsed.data.resources || [],
        status: "TODO",
      },
    });

    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    console.error("Step POST Error:", error);
    return NextResponse.json(
      { error: "Adım eklenirken hata oluştu." },
      { status: 500 }
    );
  }
}
