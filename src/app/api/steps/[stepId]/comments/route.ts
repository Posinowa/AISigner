import { NextResponse } from "next/server";
import { mezunYazmaKapisi } from "@/lib/auth/mezun-politikasi";
import { ogrencisiMi } from "@/features/teams/server/sahiplik";
import { adimErisimli } from "@/features/roadmap/server/adim-erisim";
import {
  adimYorumlariniGetir,
  adimYorumuEkle,
} from "@/features/messaging/server/adim-yorumlari";
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
    const step = await adimErisimli(stepId, userId);
    if (!step) {
      return NextResponse.json(
        { error: "Adım bulunamadı veya erişim yetkiniz yok." },
        { status: 404 }
      );
    }

    const comments = await adimYorumlariniGetir(stepId);

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
    const step = await adimErisimli(stepId, userId);
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

    const comment = await adimYorumuEkle({
      stepId,
      authorId: userId,
      content: parsed.data.content,
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
