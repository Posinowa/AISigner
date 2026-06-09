import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { createStepCommentSchema } from "@/lib/validations/api";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter("step-comments", {
  maxRequests: 20,
  windowSeconds: 60,
});

/**
 * GET /api/steps/[stepId]/comments
 * Belirli bir adımın yorumlarını listeler.
 * Erişim: Adımın bağlı olduğu mentor veya öğrenci.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId } = await params;
  const userId = auth.session.user.id!;

  try {
    // Adımın varlığını ve erişim yetkisini kontrol et
    const step = await getStepWithAccess(stepId, userId);
    if (!step) {
      return NextResponse.json(
        { error: "Adım bulunamadı veya erişim yetkiniz yok." },
        { status: 404 }
      );
    }

    const comments = await prisma.stepComment.findMany({
      where: { stepId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, name: true, lastName: true, role: true },
        },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("GET /api/steps/[stepId]/comments error:", error);
    return NextResponse.json(
      { error: "Yorumlar yüklenirken hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/steps/[stepId]/comments
 * Adıma yeni yorum ekler.
 * Erişim: Adımın bağlı olduğu mentor veya öğrenci.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId } = await params;
  const userId = auth.session.user.id!;

  const rl = limiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla yorum gönderdiniz. Lütfen biraz bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    // Adımın varlığını ve erişim yetkisini kontrol et
    const step = await getStepWithAccess(stepId, userId);
    if (!step) {
      return NextResponse.json(
        { error: "Adım bulunamadı veya erişim yetkiniz yok." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = createStepCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const comment = await prisma.stepComment.create({
      data: {
        stepId,
        authorId: userId,
        content: parsed.data.content,
      },
      include: {
        author: {
          select: { id: true, name: true, lastName: true, role: true },
        },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/steps/[stepId]/comments error:", error);
    return NextResponse.json(
      { error: "Yorum eklenirken hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * Adımın erişim yetkisini kontrol eder.
 * Mentor: Adımın roadmap'inin projesinin öğrencisi kendisine atanmış mı?
 * Öğrenci: Adımın roadmap'inin projesi kendisine ait mi?
 */
async function getStepWithAccess(stepId: string, userId: string) {
  const step = await prisma.roadmapStep.findUnique({
    where: { id: stepId },
    include: {
      roadmap: {
        include: {
          assignedProject: {
            include: {
              studentProfile: true,
            },
          },
        },
      },
    },
  });

  if (!step) return null;

  const profile = step.roadmap.assignedProject.studentProfile;

  // Öğrenci kendi adımına erişebilir
  if (profile.userId === userId) return step;

  // Mentor, atanmış öğrencisinin adımına erişebilir
  if (profile.mentorId === userId) return step;

  return null;
}
