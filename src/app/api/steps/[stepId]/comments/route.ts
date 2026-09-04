import { NextResponse } from "next/server";
import { mezunYazmaKapisi } from "@/lib/auth/mezun-politikasi";
import { prisma } from "@/lib/db";
import {
  ATAMA_SAHIPLIK_SELECT,
  erisebilirMi,
  ogrencisiMi,
} from "@/features/teams/server/sahiplik";
import { requireAuth } from "@/lib/auth/guard";
import { createStepCommentSchema } from "@/lib/validations/api";
import { createRateLimiter } from "@/lib/rate-limit";
import { rotaHatasi } from "@/lib/api-hata";

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
    rotaHatasi("GET /api/steps/[stepId]/comments error:", error);
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

  const rl = await limiter.check(userId);
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

    // #208: Mezun stajyerler için portfolyo salt-okunurdur (Seçenek A).
    const mezunKapisi = mezunYazmaKapisi(auth.session, "Mezun öğrenciler staj adımlarına yorum ekleyemez.");
    if (mezunKapisi) return mezunKapisi;

    // #52: Öğrenci yalnızca PUBLISHED roadmap adımına yorum ekleyebilir.
    // Mentor, taslağı (DRAFT) düzenleme/inceleme için yorum yapabilir.
    const isStudent = ogrencisiMi(step.roadmap.assignedProject, userId);
    if (isStudent && step.roadmap.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Bu yol haritası henüz yayınlanmadı. Yayınlandığında etkileşim kurabilirsiniz." },
        { status: 403 }
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
    rotaHatasi("POST /api/steps/[stepId]/comments error:", error);
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
          // #332: Sahiplik bireysel VEYA takım olabilir; tek tanımdan gelir.
          assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
        },
      },
    },
  });

  if (!step) return null;

  // #332: Öğrenci = bireysel sahip ya da AKTİF takım üyesi.
  // Mentör = öğrencinin kendi mentörü (#195) ya da takımın mentörü.
  if (erisebilirMi(step.roadmap.assignedProject, userId)) return step;

  return null;
}
