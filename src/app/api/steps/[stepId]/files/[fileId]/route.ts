import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { isAssignedMentor } from "@/lib/auth/mentor-access";
import { readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "steps");

/**
 * GET /api/steps/[stepId]/files/[fileId]
 * Dosyayı indirir / serve eder.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ stepId: string; fileId: string }> }
) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId, fileId } = await params;
  const userId = auth.session.user.id!;

  try {
    const stepFile = await prisma.stepFile.findUnique({
      where: { id: fileId },
      include: {
        step: {
          include: {
            roadmap: {
              include: {
                assignedProject: {
                  include: {
                    studentProfile: {
                      include: { mentorAssignments: { select: { mentorId: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!stepFile || stepFile.stepId !== stepId) {
      return NextResponse.json(
        { error: "Dosya bulunamadı." },
        { status: 404 }
      );
    }

    // Erişim kontrolü
    const profile = stepFile.step.roadmap.assignedProject.studentProfile;
    // #195: M:N — sahibi ya da mentorlarından biri değilse reddet.
    if (profile.userId !== userId && !isAssignedMentor(profile.mentorAssignments, userId)) {
      return NextResponse.json(
        { error: "Bu dosyaya erişim yetkiniz yok." },
        { status: 403 }
      );
    }

    const filePath = path.join(UPLOAD_DIR, stepFile.storedName);
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "Dosya sunucuda bulunamadı." },
        { status: 404 }
      );
    }

    const buffer = await readFile(filePath);
    const uint8 = new Uint8Array(buffer);

    // Resim ve PDF için inline, diğerleri için attachment
    const isInline = stepFile.mimeType.startsWith("image/") || stepFile.mimeType === "application/pdf";
    const disposition = isInline
      ? `inline; filename="${encodeURIComponent(stepFile.fileName)}"`
      : `attachment; filename="${encodeURIComponent(stepFile.fileName)}"`;

    return new Response(uint8, {
      headers: {
        "Content-Type": stepFile.mimeType,
        "Content-Disposition": disposition,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    console.error("GET /api/steps/[stepId]/files/[fileId] error:", error);
    return NextResponse.json(
      { error: "Dosya indirilirken hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/steps/[stepId]/files/[fileId]
 * Dosyayı siler. Yükleyen veya mentor silebilir.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ stepId: string; fileId: string }> }
) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId, fileId } = await params;
  const userId = auth.session.user.id!;
  const userRole = auth.session.user.role;

  try {
    const stepFile = await prisma.stepFile.findUnique({
      where: { id: fileId },
      include: {
        step: {
          include: {
            roadmap: {
              include: {
                assignedProject: {
                  include: {
                    studentProfile: {
                      include: { mentorAssignments: { select: { mentorId: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!stepFile || stepFile.stepId !== stepId) {
      return NextResponse.json(
        { error: "Dosya bulunamadı." },
        { status: 404 }
      );
    }

    // Erişim kontrolü: yükleyen veya mentor silebilir
    const profile = stepFile.step.roadmap.assignedProject.studentProfile;
    const isUploader = stepFile.uploaderId === userId;
    // #195: M:N — mentör, öğrencinin mentorlarından biri mi?
    const isMentor = userRole === "MENTOR" && isAssignedMentor(profile.mentorAssignments, userId);

    if (!isUploader && !isMentor) {
      return NextResponse.json(
        { error: "Bu dosyayı silme yetkiniz yok." },
        { status: 403 }
      );
    }

    // Dosyayı diskten sil
    const filePath = path.join(UPLOAD_DIR, stepFile.storedName);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Veritabanından sil
    await prisma.stepFile.delete({ where: { id: fileId } });

    return NextResponse.json({ message: "Dosya başarıyla silindi." });
  } catch (error) {
    console.error("DELETE /api/steps/[stepId]/files/[fileId] error:", error);
    return NextResponse.json(
      { error: "Dosya silinirken hata oluştu." },
      { status: 500 }
    );
  }
}
