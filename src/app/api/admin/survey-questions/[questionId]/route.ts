import { NextResponse } from "next/server";
import {
  updateSurveyQuestion,
  deleteSurveyQuestion,
} from "@/features/survey/server/survey";
import { requireAuth } from "@/lib/auth/guard";
import { updateSurveyQuestionSchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * PATCH /api/admin/survey-questions/[questionId]
 * Anket sorusunu günceller veya pasifleştirir (isActive:false) — admin.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const { questionId } = await params;
    const body = await req.json();
    const parsed = updateSurveyQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const updated = await updateSurveyQuestion(questionId, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    rotaHatasi("PATCH /api/admin/survey-questions/[questionId] error:", error);
    return NextResponse.json(
      { error: "Anket sorusu güncellenirken hata oluştu." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/survey-questions/[questionId]
 * Anket sorusunu siler (cevapları cascade ile silinir) — admin.
 */
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const { questionId } = await params;
    await deleteSurveyQuestion(questionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    rotaHatasi("DELETE /api/admin/survey-questions/[questionId] error:", error);
    return NextResponse.json(
      { error: "Anket sorusu silinirken hata oluştu." },
      { status: 500 },
    );
  }
}
