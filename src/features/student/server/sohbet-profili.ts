import "server-only";
import { prisma } from "@/lib/db";

/**
 * Posilog sohbetinin öğrenci bağlamı için profil sorgusu (`/api/student/ai-chat`).
 *
 * Proje ve roadmap bilgisi bireysel VE takım atamasından gelir (#376); yetki
 * ve bağlam metninin kurulması route'ta kalır.
 */
export async function ogrenciSohbetProfiliniGetir(userId: string) {
  const ATAMA_ICERIK = {
    include: {
      projectTemplate: { select: { title: true, track: true, difficulty: true } },
      roadmap: {
        include: {
          steps: {
            orderBy: { order: "asc" as const },
            select: { title: true, status: true, order: true },
          },
        },
      },
    },
  };

  return prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      assignedProjects: ATAMA_ICERIK,
      // Ayrılmış üyelik sayılmaz: adım artık onun işi değil.
      teamMemberships: {
        where: { leftAt: null },
        select: {
          team: {
            select: { name: true, assignedProjects: ATAMA_ICERIK },
          },
        },
      },
    },
  });
}
