import "server-only";
import { prisma } from "@/lib/db";

/** Öğrenci paneli: profil, projeler ve yol haritası. */
export async function dashboardProfiliniGetir(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      assignedProjects: {
        include: {
          projectTemplate: true,
          roadmap: {
            include: {
              steps: {
                orderBy: { order: "asc" },
                // #407: Yorum sayısı LİSTE SORGUSUNDAN geliyor. Adım başına
                // ayrı istek, uzun bir yol haritasında N+1 üretirdi.
                include: { _count: { select: { comments: true } } },
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
      },
      // #195: M:N — "mentörün var mı?" kontrolü için atamalar.
      mentorAssignments: { select: { mentorId: true } },
      // #367: TAKIM ATAMALARI AYRI GELİR.
      //
      // `assignedProjects` yalnız `studentProfileId` dolu satırları getiriyor;
      // takım atamasında o alan NULL (sahiplik `teamId` üzerinden, #332).
      // Bu olmadan takım üyesi kendi panosunda projesini HİÇ göremiyordu.
      teamMemberships: {
        where: { leftAt: null },
        select: {
          team: {
            select: {
              id: true,
              name: true,
              members: {
                where: { leftAt: null },
                select: {
                  role: true,
                  studentProfile: {
                    select: { user: { select: { id: true, name: true, lastName: true, email: true } } },
                  },
                },
              },
              assignedProjects: {
                include: {
                  projectTemplate: true,
                  roadmap: {
                    include: {
                      steps: {
                        orderBy: { order: "asc" },
                        include: {
                          assignee: { select: { id: true, name: true, lastName: true, email: true } },
                          // #407: Yorum sayısı — bireysel sorguyla aynı.
                          _count: { select: { comments: true } },
                        },
                      },
                    },
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });
}
