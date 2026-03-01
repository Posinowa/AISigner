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
    const { stepId } = await params;
    const body = await req.json();
    const parsed = updateStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const step = await prisma.roadmapStep.update({
      where: { id: stepId },
      data: parsed.data,
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
