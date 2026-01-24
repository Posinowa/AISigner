// src/features/mentor/server/actions.ts
import { prisma } from "@/lib/db";

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
          mentorId: mentorId,
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
    console.error("Error fetching mentor students:", error);
    return [];
  }
}

// Tek öğrenci detayını getir
export async function getStudentDetail(studentId: string, mentorId: string) {
  try {
    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        role: "STUDENT",
        studentProfile: {
          mentorId: mentorId,
        },
      },
      include: {
        studentProfile: {
          include: {
            assignedProjects: {
              include: {
                projectTemplate: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    return student;
  } catch (error) {
    console.error("Error fetching student detail:", error);
    return null;
  }
}

// Mevcut proje şablonlarını getir
export async function getAvailableProjects() {
  try {
    return await prisma.projectTemplate.findMany({
      orderBy: {
        title: "asc",
      },
    });
  } catch (error) {
    console.error("Error fetching project templates:", error);
    return [];
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
        mentorId: mentorId,
      },
    });

    if (!studentProfile) {
      throw new Error("Bu öğrenci size atanmamış");
    }

    // Aynı projeyi daha önce atanmış mı kontrol et
    const existingAssignment = await prisma.assignedProject.findFirst({
      where: {
        studentProfileId,
        projectTemplateId,
      },
    });

    if (existingAssignment) {
      throw new Error("Bu proje zaten öğrenciye atanmış");
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
    console.error("Error assigning project:", error);
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
          mentorId: mentorId,
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
    console.error("Error updating project status:", error);
    throw error;
  }
}
// Proje atamasını sil (Geri al)
export async function unassignProject(assignedProjectId: string) {
  try {
    return await prisma.assignedProject.delete({
      where: {
        id: assignedProjectId,
      },
    });
  } catch (error) {
    console.error("Error unassigning project:", error);
    throw error;
  }
}