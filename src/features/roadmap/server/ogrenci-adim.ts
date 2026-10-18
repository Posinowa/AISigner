import "server-only";
import { prisma } from "@/lib/db";
import { ATAMA_SAHIPLIK_SELECT } from "@/features/teams/server/sahiplik";

/**
 * Öğrencinin adım durumu güncellemesinin veri erişimi (`PATCH /api/student/steps/[stepId]`).
 *
 * Geçiş kuralları ve yetki kararları route'ta kalır. Durum geçişinin geçmişe
 * yazılması (#324) `step-status.ts` içindedir; burada yalnız okuma ve proje durumu
 * güncellemesi var.
 */

/** Adımı, roadmap'ini, sahipliğini ve roadmap'in tüm adımlarını birlikte getirir. */
export async function ogrenciAdiminiBul(stepId: string) {
  return prisma.roadmapStep.findUnique({
    where: { id: stepId },
    include: {
      roadmap: {
        include: {
          // #332: Sahiplik bireysel VEYA takım; tek tanımdan gelir.
          assignedProject: {
            select: { id: true, status: true, ...ATAMA_SAHIPLIK_SELECT },
          },
          steps: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });
}

/** Bir yol haritasının adımlarını (tamamlanma kontrolü için) getirir. */
export async function roadmapAdimlariniGetir(roadmapId: string) {
  return prisma.roadmapStep.findMany({
    where: { roadmapId },
  });
}

/** Atanmış projenin durumunu günceller. */
export async function projeDurumunuAyarla(
  projectId: string,
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED",
) {
  await prisma.assignedProject.update({
    where: { id: projectId },
    data: { status },
  });
}

/** Adımın üstlenme kararı için gereken alanlar: yol haritası durumu ve sahiplik. */
export async function adimUstlenmeBilgisi(stepId: string) {
  return prisma.roadmapStep.findUnique({
    where: { id: stepId },
    select: {
      id: true,
      roadmap: {
        select: {
          status: true,
          assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
        },
      },
    },
  });
}
