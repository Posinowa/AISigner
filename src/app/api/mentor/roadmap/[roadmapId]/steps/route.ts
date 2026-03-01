import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST: Roadmap'e yeni adım ekle
export async function POST(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  try {
    const { roadmapId } = await params;
    const body = await req.json();
    const { title, description, estimatedHours, resources } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Başlık ve açıklama zorunludur." },
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
        title,
        description,
        estimatedHours: estimatedHours || null,
        resources: resources || [],
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
