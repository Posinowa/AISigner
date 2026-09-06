import { NextResponse } from "next/server";
import {
  saveSurveyAnswers,
  SurveyValidationError,
} from "@/features/survey/server/survey";
import { requireAuth } from "@/lib/auth/guard";
import { saveSurveyAnswersSchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * POST /api/student/survey-answers
 * Öğrencinin anket cevaplarını profile bağlı olarak kaydeder (soru başına upsert).
 */
export async function POST(req: Request) {
  // #143: Anket, profil tamamlama akışının parçası — PENDING stajyer de
  // cevaplarını kaydedebilmeli (onaya dolu profille düşsün).
  const auth = await requireAuth("STUDENT", { allowUnapprovedStudent: true });
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;

  try {
    const body = await req.json();
    const parsed = saveSurveyAnswersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await saveSurveyAnswers(userId, parsed.data.answers);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // Geçersiz/pasif soru veya profil yok → 400 (kullanıcı dostu mesaj).
    if (error instanceof SurveyValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    rotaHatasi("POST /api/student/survey-answers error:", error);
    return NextResponse.json(
      { error: "Cevaplar kaydedilirken hata oluştu." },
      { status: 500 },
    );
  }
}
