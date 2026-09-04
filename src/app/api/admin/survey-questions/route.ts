import { NextResponse } from "next/server";
import {
  listSurveyQuestions,
  createSurveyQuestion,
} from "@/features/survey/server/survey";
import { requireAuth } from "@/lib/auth/guard";
import { createSurveyQuestionSchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * GET /api/admin/survey-questions
 * Tüm anket sorularını listeler (admin).
 */
export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const questions = await listSurveyQuestions();
    return NextResponse.json(questions);
  } catch (error) {
    rotaHatasi("GET /api/admin/survey-questions error:", error);
    return NextResponse.json(
      { error: "Anket soruları yüklenirken hata oluştu." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/survey-questions
 * Yeni anket sorusu oluşturur (admin).
 */
export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = createSurveyQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const created = await createSurveyQuestion(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    rotaHatasi("POST /api/admin/survey-questions error:", error);
    return NextResponse.json(
      { error: "Anket sorusu oluşturulurken hata oluştu." },
      { status: 500 },
    );
  }
}
