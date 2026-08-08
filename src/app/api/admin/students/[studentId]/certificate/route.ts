import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  getStudentCertificate,
  updateCertificateDetails,
} from "@/features/certificate/server/certificate";
import { z } from "zod";

const updateCertificateSchema = z.object({
  certificateNumber: z.string().optional(),
  mentorNote: z.string().max(2000, "Referans notu en fazla 2000 karakter olabilir.").optional(),
  completionGrade: z.string().optional(),
});

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

    const updated = await updateCertificateDetails(certificate.id, {
      certificateNumber: parsed.data.certificateNumber,
      mentorNote: parsed.data.mentorNote,
      completionGrade: parsed.data.completionGrade,
      issuedAt: new Date(),
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
