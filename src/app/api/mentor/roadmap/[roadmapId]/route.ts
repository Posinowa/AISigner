import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: Roadmap detayını getir
export async function GET(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string }> }
) {
  try {
    const { roadmapId } = await params;

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        steps: { orderBy: { order: "asc" } },
        assignedProject: {
          include: {
            projectTemplate: true,
            studentProfile: {
              include: {
                user: {
                  select: { name: true, lastName: true, email: true },
                },
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
  try {
    const { roadmapId } = await params;
    const body = await req.json();
    const { title, status } = body;

    const updateData: Record<string, string> = {};
    if (title) updateData.title = title;
    if (status && ["DRAFT", "PUBLISHED"].includes(status)) {
      updateData.status = status;
    }

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
