import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { isAssignedMentor } from "@/lib/auth/mentor-access";
import { updateStepCommentSchema } from "@/lib/validations/api";

/**
 * PUT /api/steps/[stepId]/comments/[commentId]
 * Yorumu günceller. Sadece yorum sahibi düzenleyebilir.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ stepId: string; commentId: string }> }
) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId, commentId } = await params;
  const userId = auth.session.user.id!;

  try {
    const comment = await prisma.stepComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: "Yorum bulunamadı." }, { status: 404 });
    }

    // Yorumun bu adıma ait olduğunu doğrula
    if (comment.stepId !== stepId) {
      return NextResponse.json({ error: "Yorum bu adıma ait değil." }, { status: 400 });
    }

    // Sadece yorum sahibi düzenleyebilir
    if (comment.authorId !== userId) {
      return NextResponse.json(
        { error: "Sadece kendi yorumunuzu düzenleyebilirsiniz." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateStepCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await prisma.stepComment.update({
      where: { id: commentId },
      data: { content: parsed.data.content },
      include: {
        author: {
          select: { id: true, name: true, lastName: true, role: true },
        },
      },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error("PUT /api/steps/[stepId]/comments/[commentId] error:", error);
    return NextResponse.json(
      { error: "Yorum güncellenirken hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/steps/[stepId]/comments/[commentId]
 * Yorumu siler. Yorum sahibi veya mentor (adım sahibi) silebilir.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ stepId: string; commentId: string }> }
) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId, commentId } = await params;
  const userId = auth.session.user.id!;

  try {
    const comment = await prisma.stepComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: "Yorum bulunamadı." }, { status: 404 });
    }

    // Yorumun bu adıma ait olduğunu doğrula
    if (comment.stepId !== stepId) {
      return NextResponse.json({ error: "Yorum bu adıma ait değil." }, { status: 400 });
    }

    // Yorum sahibi silebilir
    if (comment.authorId === userId) {
      await prisma.stepComment.delete({ where: { id: commentId } });
      return NextResponse.json({ success: true });
    }

    // Mentor, kendi öğrencisinin adımındaki herhangi bir yorumu silebilir
    const step = await prisma.roadmapStep.findUnique({
      where: { id: stepId },
      include: {
        roadmap: {
          include: {
            assignedProject: {
              include: {
                studentProfile: {
                  include: { mentorAssignments: { select: { mentorId: true } } },
                },
              },
            },
          },
        },
      },
    });

    // #195: M:N — öğrencinin mentorlarından biri mi?
    if (isAssignedMentor(step?.roadmap.assignedProject.studentProfile.mentorAssignments, userId)) {
      await prisma.stepComment.delete({ where: { id: commentId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Bu yorumu silme yetkiniz yok." },
      { status: 403 }
    );
  } catch (error) {
    console.error("DELETE /api/steps/[stepId]/comments/[commentId] error:", error);
    return NextResponse.json(
      { error: "Yorum silinirken hata oluştu." },
      { status: 500 }
    );
  }
}
