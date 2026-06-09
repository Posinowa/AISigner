import { NextResponse } from "next/server";
import {prisma} from "@/lib/db"; 
import { recommendProjects } from "@/features/ai/server/project-recommendations";
import { requireAuth } from "@/lib/auth/guard";
import { recommendProjectsSchema } from "@/lib/validations/api";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter("ai-recommend-projects", {
  maxRequests: 10,
  windowSeconds: 60,
});

export async function POST(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const rl = limiter.check(auth.session.user.id ?? "anonymous");
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
        mentorId: auth.session.user.id,
      },
    });

    if (!studentProfile) {
      return NextResponse.json(
        { error: "Öğrenci profili bulunamadı veya bu öğrenci size atanmamış!" }, 
        { status: 404 }
      );
    }

    // 3. Sistemdeki tüm müsait proje şablonlarını çekiyoruz
    const availableProjects = await prisma.projectTemplate.findMany();

    if (!availableProjects || availableProjects.length === 0) {
      return NextResponse.json(
        { error: "Sistemde değerlendirilecek proje şablonu bulunmuyor." }, 
        { status: 404 }
      );
    }

    // 4. Hazırladığımız AI servisine verileri gönderip tavsiyeleri alıyoruz
    const recommendations = await recommendProjects(studentProfile, availableProjects);

    // 5. Sonuçları frontend'e JSON olarak başarıyla dönüyoruz
    return NextResponse.json({ recommendations }, { status: 200 });

  } catch (error) {
    const err = error as Error & { cause?: Error; status?: number; httpError?: { statusCode?: number } };
    const rootCause = err.cause?.message || err.message || String(error);
    console.error("AI Öneri API Hatası:", rootCause);
    console.error("Tam hata:", error);
    return NextResponse.json(
      { error: rootCause },
      { status: 500 }
    );
  }
}