import { prisma } from "@/lib/db";
import { mentorunOgrencisiWhere } from "@/features/teams/server/sahiplik";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { atamaTekilKey } from "@/features/projects/tekil-anahtar";

// #58: Aynı proje aynı öğrenciye iki kez atanmaya çalışılırsa — route bunu 409'a çevirir.
export class AssignmentConflictError extends Error {
  constructor(message = "Bu proje zaten öğrenciye atanmış") {
    super(message);
    this.name = "AssignmentConflictError";
  }
}

// Öğrenciye proje ata
export async function assignProjectToStudent(
  studentProfileId: string,
  projectTemplateId: string,
  mentorId: string
) {
  try {
    // Önce bu mentor'un bu öğrenciyi yönetip yönetmediğini kontrol et
    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        id: studentProfileId,
        // #370: bireysel VEYA takım bağı.
        ...mentorunOgrencisiWhere(mentorId),
      },
    });

    if (!studentProfile) {
      throw new Error("Bu öğrenci size atanmamış");
    }

    // #503: Şablon TEKRARLANABİLİR mi? Portfolyo sitesi gibi herkesin yapması
    // beklenen işler ve araştırma ödevleri aynı stajyere birden çok kez
    // atanabilmeli.
    const sablon = await prisma.projectTemplate.findUnique({
      where: { id: projectTemplateId },
      select: { tekrarlanabilir: true },
    });
    if (!sablon) {
      throw new AssignmentConflictError();
    }

    // Aynı projeyi daha önce atanmış mı kontrol et (hızlı yol — kullanıcı dostu)
    //
    // ⚠️ TEKRARLANABİLİR ŞABLONDA BU KONTROL ATLANIR (#503). Kontrolün amacı
    // #58'in "aynı proje aynı öğrenciye iki kez" korumasıydı; tekrarlanabilir
    // şablonlarda o davranış İSTENEN şey.
    if (!sablon.tekrarlanabilir) {
      const existingAssignment = await prisma.assignedProject.findFirst({
        where: {
          studentProfileId,
          projectTemplateId,
        },
      });

      if (existingAssignment) {
        throw new AssignmentConflictError();
      }
    }

    // Projeyi ata
    const assignedProject = await prisma.assignedProject.create({
      data: {
        studentProfileId,
        projectTemplateId,
        status: "PENDING",
        // #503: Koşullu tekillik. Tekrarlanamaz şablonda anahtar dolu →
        // yarış koruması (P2002) aynen sürer; tekrarlanabilirde NULL.
        tekilKey: atamaTekilKey({
          projectTemplateId,
          tekrarlanabilir: sablon.tekrarlanabilir,
          studentProfileId,
        }),
      },
      include: {
        projectTemplate: true,
        studentProfile: {
          include: {
            user: {
              select: {
                name: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return assignedProject;
  } catch (error) {
    // Zaten kullanıcı dostu çakışma hatası → olduğu gibi yükselt (gürültülü loglama yok).
    if (error instanceof AssignmentConflictError) {
      throw error;
    }
    // #58: Yarış koşulu — ön kontrolü aynı anda geçen iki istekten biri DB unique
    // ihlaline (P2002) düşer. Bunu da kullanıcı dostu çakışma hatasına çeviriyoruz.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AssignmentConflictError();
    }
    logger.error("Error assigning project:", error);
    throw error;
  }
}

// Proje durumunu güncelle
export async function updateProjectStatus(
  assignedProjectId: string,
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED",
  mentorId: string
) {
  try {
    // Mentor yetki kontrolü
    const assignedProject = await prisma.assignedProject.findFirst({
      where: {
        id: assignedProjectId,
        // #370: bireysel VEYA takım bağı.
        studentProfile: mentorunOgrencisiWhere(mentorId),
      },
    });

    if (!assignedProject) {
      throw new Error("Bu projeyi güncelleme yetkiniz yok");
    }

    return await prisma.assignedProject.update({
      where: {
        id: assignedProjectId,
      },
      data: {
        status,
      },
      include: {
        projectTemplate: true,
      },
    });
  } catch (error) {
    logger.error("Error updating project status:", error);
    throw error;
  }
}

// Proje atamasını sil (Geri al)
// İlerlemeyi sessizce silmemek için: aktif/tamamlanmış proje veya
// PUBLISHED roadmap varsa force=true gelmeden silmez.
export async function unassignProject(
  assignedProjectId: string,
  mentorId: string,
  force = false
) {
  // Mentor ownership + ilerleme bilgisi
  const assignedProject = await prisma.assignedProject.findFirst({
    where: {
      id: assignedProjectId,
      // #370: bireysel VEYA takım bağı.
      studentProfile: mentorunOgrencisiWhere(mentorId),
    },
    include: {
      roadmap: {
        select: {
          status: true,
          steps: { select: { status: true } },
        },
      },
    },
  });

  if (!assignedProject) {
    throw new Error("Bu projeyi silme yetkiniz yok veya proje bulunamadı");
  }

  if (!force) {
    const hasProgress = assignedProject.status !== "PENDING";
    const roadmapPublished = assignedProject.roadmap?.status === "PUBLISHED";
    const hasStepProgress =
      assignedProject.roadmap?.steps.some(
        (s) => s.status === "IN_PROGRESS" || s.status === "COMPLETED"
      ) ?? false;

    if (hasProgress || roadmapPublished || hasStepProgress) {
      const err = new Error(
        "Bu projede öğrenci ilerlemesi var. Silmek için onay gerekiyor."
      ) as Error & { code?: string };
      err.code = "REQUIRES_CONFIRMATION";
      throw err;
    }
  }

  return prisma.assignedProject.delete({
    where: { id: assignedProjectId },
  });
}
