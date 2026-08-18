import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { isAssignedMentor } from "@/lib/auth/mentor-access";
import { readStepFile, deleteStepFile } from "@/lib/storage/step-files";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";

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

    // #197: GCS veya yerel diskten oku (backend env'e göre).
    const buffer = await readStepFile(stepFile.storedName);
    if (!buffer) {
      return NextResponse.json(
        { error: "Dosya sunucuda bulunamadı." },
        { status: 404 }
      );
    }

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

  // #208: Mezun stajyerler için portfolyo salt-okunurdur (Seçenek A).
  if (auth.session.user.role === "STUDENT" && auth.session.user.accountStatus === "GRADUATED") {
    return NextResponse.json(
      { error: "Mezun öğrenciler staj adımlarından dosya silemez." },
      { status: 403 }
    );
  }

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

    // #201: Önce veritabanı kaydını sil (tutarlılık garantisi)
    await prisma.stepFile.delete({ where: { id: fileId } });

    // #197: GCS veya yerel diskten sil (backend env'e göre)
    try {
      await deleteStepFile(stepFile.storedName);
    } catch (delErr) {
      // DB kaydı zaten silindi; storage silinemezse dosya öksüz kalır → operasyonel
      // takip için logger + metrik (#201 review: sessiz console.error yerine).
      incrementCounter("storage.delete.failure");
      logger.error("Adım dosyası storage'dan silinemedi (DB kaydı silindi)", {
        storedName: stepFile.storedName,
        fileId,
        err: delErr,
      });
    }

    return NextResponse.json({ message: "Dosya başarıyla silindi." });
  } catch (error) {
    console.error("DELETE /api/steps/[stepId]/files/[fileId] error:", error);
    return NextResponse.json(
      { error: "Dosya silinirken hata oluştu." },
      { status: 500 }
    );
  }
}
