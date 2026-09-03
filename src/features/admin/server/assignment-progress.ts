import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ilerlemeHesapla, duraklamaMetni } from "@/features/progress/ilerleme";

export type StudentAssignmentProgress = {
  assignmentId: string;
  // #332: Takım atamasında tek bir öğrenci yok — bu üçü null olabilir.
  studentId: string | null;
  studentName: string;
  studentEmail: string | null;
  experienceLevel: string | null;
  /// #332: Doluysa satır bir TAKIMI temsil eder.
  teamId: string | null;
  teamMembers: { name: string; role: string }[];
  // #195: M:N — öğrenciye atanmış mentorlar (0..n).
  // #332: Takımda mentörler takıma atanır.
  mentors: { id: string; name: string }[];
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
  /** #432: Durakladıysa "10 gündür hareket yok", aksi halde null. */
  duraklamaMetni: string | null;
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
  // Güvenlik (#178-2): requireAuth hata FIRLATMAZ, { authorized } döndürür.
  // Dönüş değeri kontrol edilmezse kontrol işlevsizdir. provisioning.ts ile
  // birebir aynı desen — çağıran route ADMIN kontrolü yapsa da savunma-derinliği
  // için burada da açıkça reddediyoruz.
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.authorized) {
    throw new Error("Bu işlem için yönetici yetkisi gerekiyor");
  }

  const assignments = await prisma.assignedProject.findMany({
    include: {
      // #332: Atama bireysel VEYA takım olabilir.
      team: {
        select: {
          id: true,
          name: true,
          members: {
            where: { leftAt: null },
            select: {
              role: true,
              studentProfile: {
                select: { userId: true, user: { select: { name: true, lastName: true, email: true } } },
              },
            },
          },
          mentors: {
            select: {
              mentor: { select: { id: true, name: true, lastName: true, email: true } },
            },
          },
        },
      },
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
          // #195: M:N — atanmış mentorlar.
          mentorAssignments: {
            include: {
              mentor: {
                select: { id: true, name: true, lastName: true, email: true },
              },
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

  const ad = (u: { name: string | null; lastName: string | null; email: string }) =>
    [u.name, u.lastName].filter(Boolean).join(" ") || u.email;

  return assignments.map((assignment) => {
    const takim = assignment.team;
    const studentUser = assignment.studentProfile?.user ?? null;

    // #332: Takım atamasında satır TAKIMI temsil eder. Üyelerden birini seçip
    // "öğrenci" diye göstermek yanıltıcı olurdu — pano ortak.
    const studentName = takim
      ? `${takim.name} (${takim.members.length} kişi)`
      : studentUser
        ? ad(studentUser)
        : "—";

    // #195: M:N — atanmış mentorların görünen adları.
    // #332: Takımda mentörler takıma atanır.
    const mentors = takim
      ? takim.mentors.map((m) => ({ id: m.mentor.id, name: ad(m.mentor) }))
      : (assignment.studentProfile?.mentorAssignments ?? []).map((a) => ({
          id: a.mentor.id,
          name: ad(a.mentor),
        }));

    const steps = assignment.roadmap?.steps ?? [];
    // #432: Hesap ortak modülde — mentör panosu da aynısını kullanıyor.
    // Burada gömülü kaldığı sürece ikinci bir kopya kaçınılmazdı.
    const { toplamAdim: totalSteps, tamamlanan: completedSteps, yuzde: progressPercentage } =
      ilerlemeHesapla(steps);

    const lastUpdatedStep = steps[0]; // orderBy updatedAt desc
    const lastActivity = lastUpdatedStep
      ? {
          title: lastUpdatedStep.title,
          updatedAt: lastUpdatedStep.updatedAt,
        }
      : null;

    return {
      assignmentId: assignment.id,
      // #332: Takım atamasında tek bir öğrenci kimliği yok.
      studentId: assignment.studentProfile?.userId ?? null,
      studentName,
      studentEmail: studentUser?.email ?? null,
      experienceLevel: assignment.studentProfile?.experienceLevel ?? null,
      // #332: Arayüz satırın takım mı birey mi olduğunu ayırt edebilsin.
      teamId: takim?.id ?? null,
      teamMembers: takim
        ? takim.members.map((m) => ({ name: ad(m.studentProfile.user), role: m.role }))
        : [],
      mentors,
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
      // #432: "10 gündür hareket yok" — skor değil sinyal (#331/#397).
      duraklamaMetni: duraklamaMetni(steps),
      lastActivity,
      roadmapId: assignment.roadmap?.id ?? null,
      roadmapStatus: assignment.roadmap?.status ?? null,
    };
  });
}
