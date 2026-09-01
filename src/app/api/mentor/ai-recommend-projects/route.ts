import { NextResponse } from "next/server";
import {prisma} from "@/lib/db"; 
import { recommendProjects } from "@/features/ai/server/project-recommendations";
import { requireAuth } from "@/lib/auth/guard";
import { recommendProjectsSchema } from "@/lib/validations/api";
import { createRateLimiter } from "@/lib/rate-limit";
import { profilSahibininRizasiVar } from "@/features/kvkk/riza";

const limiter = createRateLimiter("ai-recommend-projects", {
  maxRequests: 10,
  windowSeconds: 60,
});

export async function POST(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const rl = await limiter.check(auth.session.user.id ?? "anonymous");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen biraz bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = recommendProjectsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { studentProfileId } = parsed.data;

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        id: studentProfileId,
        // #195: M:N — bu mentör öğrencinin mentorlarından biri mi?
        mentorAssignments: { some: { mentorId: auth.session.user.id } },
      },
      // #295: Zaten atanmış projeler aday kümesinden çıkarılacak.
      include: { assignedProjects: { select: { projectTemplateId: true } } },
    });

    if (!studentProfile) {
      return NextResponse.json(
        { error: "Öğrenci profili bulunamadı veya bu öğrenci size atanmamış!" }, 
        { status: 404 }
      );
    }

    // #321: KVKK açık rıza — veri öğrenciye ait, rıza da öğrencinin.
    if (!(await profilSahibininRizasiVar(studentProfile.id))) {
      return NextResponse.json(
        {
          error:
            "Bu öğrenci yapay zekâ işleme onayı vermediği için AI üretimi " +
            "kullanılamıyor. Öğrenci onayı profilinden verebilir.",
          rizaGerekli: true,
        },
        { status: 403 },
      );
    }

    // #295: Zaten atanmış projeler aday kümesinden ÇIKARILIYOR. Eskiden
    // AI bunlara da slot harcıyordu; arayüz onları gizlediği için mentör
    // 3 yerine 1-2 kullanılabilir öneri görüyordu.
    const atanmisIdler = studentProfile.assignedProjects.map((a) => a.projectTemplateId);

    const availableProjects = await prisma.projectTemplate.findMany({
      where: atanmisIdler.length ? { id: { notIn: atanmisIdler } } : undefined,
    });

    if (!availableProjects || availableProjects.length === 0) {
      return NextResponse.json(
        { error: "Bu öğrenci için önerilebilecek yeni proje şablonu kalmadı." },
        { status: 404 }
      );
    }

    // #295: Mentörün kendi uzmanlığı da öneriye giriyor — süpervize
    // edemeyeceği bir projeye yol haritası çizemez.
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: auth.session.user.id },
      select: { expertise: true, seniority: true },
    });

    const recommendations = await recommendProjects(
      studentProfile,
      availableProjects,
      mentorProfile ?? undefined,
    );

    // 5. Sonuçları frontend'e JSON olarak başarıyla dönüyoruz
    return NextResponse.json({ recommendations }, { status: 200 });

  } catch (error) {
    // #295: Ham hata metni İSTEMCİYE DÖNMÜYOR. Eskiden `rootCause` doğrudan
    // gövdeye yazılıyordu; iç hata metni (prompt parçaları dahil olabilir)
    // istemciye sızıyordu. Ayrıntı sunucu kaydında kalıyor.
    console.error("AI Öneri API Hatası:", error);
    return NextResponse.json(
      { error: "Öneriler hazırlanamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
