import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

export type StudentAssignmentProgress = {
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  experienceLevel: string;
  mentorId: string | null;
  mentorName: string | null;
  projectTemplateId: string;
  projectTitle: string;
  projectDifficulty: string;
  assignmentStatus: string;
  githubRepoUrl: string | null;
  githubStatus: string;
  provisionedAt: Date | null;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  lastActivity: {
    title: string;
    updatedAt: Date;
  } | null;
  roadmapId: string | null;
  roadmapStatus: string | null;
};

/**
 * Admin için tüm öğrencilerin projedeki canlı ilerleme durumunu ve atamalarını çeker.
 */
export async function getStudentAssignmentsProgress(): Promise<StudentAssignmentProgress[]> {
  await requireAuth(["ADMIN"]);

  const assignments = await prisma.assignedProject.findMany({
    include: {
      studentProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              lastName: true,
              email: true,
            },
          },
          mentor: {
            select: {
              id: true,
              name: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      projectTemplate: {
        select: {
          id: true,
          title: true,
          difficulty: true,
        },
      },
      roadmap: {
        include: {
          steps: {
            orderBy: {
              updatedAt: "desc",
            },
            select: {
              id: true,
              title: true,
              status: true,
              updatedAt: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return assignments.map((assignment) => {
    const studentUser = assignment.studentProfile.user;
    const studentName = [studentUser.name, studentUser.lastName]
      .filter(Boolean)
      .join(" ") || studentUser.email;

    const mentorUser = assignment.studentProfile.mentor;
    const mentorName = mentorUser
      ? [mentorUser.name, mentorUser.lastName].filter(Boolean).join(" ") || mentorUser.email
      : null;

    const steps = assignment.roadmap?.steps ?? [];
    const totalSteps = steps.length;
    const completedSteps = steps.filter((s) => s.status === "COMPLETED").length;
    const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const lastUpdatedStep = steps[0]; // orderBy updatedAt desc
    const lastActivity = lastUpdatedStep
      ? {
          title: lastUpdatedStep.title,
          updatedAt: lastUpdatedStep.updatedAt,
        }
      : null;

    return {
      assignmentId: assignment.id,
      studentId: assignment.studentProfile.userId,
      studentName,
      studentEmail: studentUser.email,
      experienceLevel: assignment.studentProfile.experienceLevel,
      mentorId: assignment.studentProfile.mentorId,
      mentorName,
      projectTemplateId: assignment.projectTemplate.id,
      projectTitle: assignment.projectTemplate.title,
      projectDifficulty: assignment.projectTemplate.difficulty,
      assignmentStatus: assignment.status,
      githubRepoUrl: assignment.githubRepoUrl,
      githubStatus: assignment.githubStatus,
      provisionedAt: assignment.provisionedAt,
      totalSteps,
      completedSteps,
      progressPercentage,
      lastActivity,
      roadmapId: assignment.roadmap?.id ?? null,
      roadmapStatus: assignment.roadmap?.status ?? null,
    };
  });
}
