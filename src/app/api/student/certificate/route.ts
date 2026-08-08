import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getStudentCertificate } from "@/features/certificate/server/certificate";

export async function GET() {
  const auth = await requireAuth(["STUDENT", "ADMIN", "MENTOR"]);
  if (!auth.authorized) return auth.response;

  const studentUserId = auth.session.user?.id;
  if (!studentUserId) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  try {
    const certificate = await getStudentCertificate(studentUserId);
    if (!certificate) {
      return NextResponse.json(
        { error: "Sertifika verisi bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, certificate });
  } catch (error) {
    console.error("Error loading certificate:", error);
    return NextResponse.json(
      { error: "Sertifika yüklenirken bir hata oluştu." },
      { status: 500 },
    );
  }
}
