import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { getStoredProfileAnalysis } from "@/features/ai/server/profile-analysis-store";

/**
 * GET /api/admin/students/[studentId]/profile-analysis
 * #48: Admin'in tek bir öğrencinin detaylı AI analizini isteğe bağlı (lazy) çekmesi için.
 * Profil yoksa 404; profil var ama analiz henüz üretilmemişse 200 + analysis:null (empty state).
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const { studentId } = await params;

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { id: true },
    });

    if (!studentProfile) {
      return NextResponse.json(
        { error: "Öğrenci profili bulunamadı. Öğrenci henüz onboarding'i tamamlamamış olabilir." },
        { status: 404 },
      );
    }

    const analysis = await getStoredProfileAnalysis(studentProfile.id);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("GET /api/admin/students/[studentId]/profile-analysis error:", error);
    return NextResponse.json(
      { error: "Analiz yüklenirken hata oluştu." },
      { status: 500 },
    );
  }
}
