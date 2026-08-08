import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

// #58: Aynı proje aynı öğrenciye iki kez atanmaya çalışılırsa — route bunu 409'a çevirir.
export class AssignmentConflictError extends Error {
  constructor(message = "Bu proje zaten öğrenciye atanmış") {
    super(message);
    this.name = "AssignmentConflictError";
  }
}

export type StudentWithProfile = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  studentProfile: {
    id: string;
    birthYear: number | null;
    experienceLevel: string;
    interests: string[];
    goals: string | null;
    availability: string | null;
    assignedProjects: {
      id: string;
      status: string;
      projectTemplate: {
        id: string;
        title: string;
        difficulty: string;
      };
      createdAt: Date;
    }[];
  } | null;
};

// Mentor'un öğrencilerini getir
export async function getMentorStudents(mentorId: string): Promise<StudentWithProfile[]> {
  try {
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        studentProfile: {
          // #195: M:N — bu mentörün atandığı öğrenciler.
          mentorAssignments: { some: { mentorId } },
        },
      },
      include: {
        studentProfile: {
          include: {
            assignedProjects: {
              include: {
                projectTemplate: {
                  select: {
                    id: true,
                    title: true,
                    difficulty: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return students;
  } catch (error) {
    // Hatayı yutup [] DÖNMÜYORUZ: aksi halde DB hatası "öğrenci yok" gibi
    // görünür. Çağıran API route'u yakalayıp 500 döner.
    logger.error("Error fetching mentor students:", error);
    throw error;
  }
}

// Tek öğrenci detayını getir (🚀 YOL HARİTASI İLİŞKİSİ BURAYA EKLENDİ)
export async function getStudentDetail(studentId: string, mentorId: string) {
  try {
    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        role: "STUDENT",
        studentProfile: {
          // #195: M:N — öğrencinin mentorlarından biri bu mentör mü?
          mentorAssignments: { some: { mentorId } },
        },
      },
      include: {
        studentProfile: {
          include: {
            assignedProjects: {
              include: {
                projectTemplate: true,
                // 🚀 Bura Eklendi: Artık proje gelirken yol haritası ve adımları da gelecek
                roadmap: {
                  include: {
                    steps: {
                      orderBy: {
                        order: 'asc' // Adımları sırasına (1,2,3...) göre diz
                      }
                    }
                  }
                }
              },
              orderBy: {
                createdAt: "desc",
              },
            },
            // #48: Detaylı AI profil analizi (varsa) — mentor kendi öğrencisininkini görür.
            profileAnalysis: true,
          },
        },
      },
    });

    return student;
  } catch (error) {
    // "Bulunamadı" durumunu findFirst zaten null ile döner (exception atmaz);
    // buraya yalnızca gerçek DB hatasında düşülür → yutmak yerine rethrow.
    logger.error("Error fetching student detail:", error);
    throw error;
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
        // #195: M:N — bu mentör öğrencinin mentorlarından biri mi?
        mentorAssignments: { some: { mentorId } },
      },
    });

    if (!studentProfile) {
      throw new Error("Bu öğrenci size atanmamış");
    }

    // Aynı projeyi daha önce atanmış mı kontrol et (hızlı yol — kullanıcı dostu)
    const existingAssignment = await prisma.assignedProject.findFirst({
      where: {
        studentProfileId,
        projectTemplateId,
      },
    });

    if (existingAssignment) {
      throw new AssignmentConflictError();
    }

    // Projeyi ata
    const assignedProject = await prisma.assignedProject.create({
      data: {
        studentProfileId,
        projectTemplateId,
        status: "PENDING",
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
        studentProfile: {
          // #195: M:N — öğrencinin mentorlarından biri mi?
          mentorAssignments: { some: { mentorId } },
        },
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
      // #195: M:N — öğrencinin mentorlarından biri mi?
      studentProfile: { mentorAssignments: { some: { mentorId } } },
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