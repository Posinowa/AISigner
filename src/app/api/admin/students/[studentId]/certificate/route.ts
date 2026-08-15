import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import {
  getStudentCertificate,
  updateCertificateDetails,
} from "@/features/certificate/server/certificate";
import { updateCertificateSchema } from "@/lib/validations/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const auth = await requireAuth(["ADMIN", "MENTOR"]);
  if (!auth.authorized) return auth.response;

  const { studentId } = await params;
  if (!studentId) {
    return NextResponse.json({ error: "Öğrenci ID gerekli." }, { status: 400 });
  }

  // #204 IDOR: Mentör yalnızca KENDİ öğrencisinin sertifikasını görebilir (admin hepsini).
  // studentId = öğrencinin User.id'si; M:N atama üzerinden sahiplik doğrulanır.
  if (auth.session.user.role === "MENTOR") {
    const owns = await prisma.studentProfile.findFirst({
      where: {
        userId: studentId,
        mentorAssignments: { some: { mentorId: auth.session.user.id } },
      },
      select: { id: true },
    });
    if (!owns) {
      return NextResponse.json(
        { error: "Bu öğrencinin sertifikasına erişim yetkiniz yok." },
        { status: 403 },
      );
    }
  }

  try {
    const certificate = await getStudentCertificate(studentId);
    if (!certificate) {
      return NextResponse.json(
        { error: "Öğrenci sertifika profili bulunamadı." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, certificate });
  } catch (error) {
    console.error("Error loading student certificate:", error);
    return NextResponse.json(
      { error: "Sertifika bilgisi alınamadı." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.authorized) return auth.response;

  const { studentId } = await params;
  if (!studentId) {
    return NextResponse.json({ error: "Öğrenci ID gerekli." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateCertificateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." },
        { status: 400 },
      );
    }

    const certificate = await getStudentCertificate(studentId);
    if (!certificate) {
      return NextResponse.json(
        { error: "Öğrenci profili bulunamadı." },
        { status: 404 },
      );
    }

    // #208 review (P3): Not/derece kaydetmek belgeyi YAYINLAMAZ. `issuedAt`
    // gönderilmez → belge yalnız mezuniyette resmileşir (ensureCertificateIssued).
    const updated = await updateCertificateDetails(certificate.id, {
      certificateNumber: parsed.data.certificateNumber,
      mentorNote: parsed.data.mentorNote,
      completionGrade: parsed.data.completionGrade,
    });

    return NextResponse.json({
      success: true,
      message: "Sertifika ve referans notu başarıyla güncellendi.",
      updated,
    });
  } catch (error) {
    console.error("Error updating certificate:", error);
    return NextResponse.json(
      { error: "Sertifika güncellenemedi." },
      { status: 500 },
    );
  }
}
