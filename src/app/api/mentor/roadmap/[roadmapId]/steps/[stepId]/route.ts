import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { updateStepSchema } from "@/lib/validations/api";

// PUT: Adımı güncelle
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string; stepId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const { roadmapId, stepId } = await params;

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
        { error: "Bu adımı güncelleme yetkiniz yok." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Status alanını mentor tarafından güncellenebilir alanlardan çıkar
    const safeData = { ...parsed.data };
    delete (safeData as { status?: string }).status;

    const step = await prisma.roadmapStep.update({
      where: { id: stepId },
      data: safeData,
    });

    return NextResponse.json(step);
  } catch (error) {
    console.error("Step PUT Error:", error);
    return NextResponse.json(
      { error: "Adım güncellenirken hata oluştu." },
      { status: 500 }
    );
  }
}

// DELETE: Adımı sil
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string; stepId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const { roadmapId, stepId } = await params;

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
        { error: "Bu adımı silme yetkiniz yok." },
        { status: 403 }
      );
    }

    // Öğrenci ilerlemesi koruması: aktif/tamamlanmış adımlar ?force=true olmadan silinemez
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const step = await prisma.roadmapStep.findUnique({
      where: { id: stepId },
      select: { status: true },
    });

    if (!step) {
      return NextResponse.json({ error: "Adım bulunamadı." }, { status: 404 });
    }

    if (!force && (step.status === "IN_PROGRESS" || step.status === "COMPLETED")) {
      return NextResponse.json(
        {
          error:
            "Bu adımda öğrenci ilerlemesi var. Silmek için onay gerekiyor.",
          requiresConfirmation: true,
          stepStatus: step.status,
        },
        { status: 409 }
      );
    }

    await prisma.roadmapStep.delete({
      where: { id: stepId },
    });

    // Silinen adımdan sonraki adımların sırasını güncelle
    const remainingSteps = await prisma.roadmapStep.findMany({
      where: { roadmapId },
      orderBy: { order: "asc" },
    });

    for (let i = 0; i < remainingSteps.length; i++) {
      if (remainingSteps[i].order !== i + 1) {
        await prisma.roadmapStep.update({
          where: { id: remainingSteps[i].id },
          data: { order: i + 1 },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Step DELETE Error:", error);
    return NextResponse.json(
      { error: "Adım silinirken hata oluştu." },
      { status: 500 }
    );
  }
}
