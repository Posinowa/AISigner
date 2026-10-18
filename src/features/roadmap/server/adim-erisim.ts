import "server-only";
import { prisma } from "@/lib/db";
import { ATAMA_SAHIPLIK_SELECT, erisebilirMi } from "@/features/teams/server/sahiplik";

/**
 * Yol haritası adımının sahiplik bilgisiyle okunması ve erişim kararı.
 *
 * Yorum ve dosya uçları aynı kuralı kullanır; kural burada tek kez yazılır.
 */

/** Adımı, roadmap'i ve atama sahipliğiyle birlikte getirir (yetki kararı yok). */
export async function adimSahiplikBilgisi(stepId: string) {
  return prisma.roadmapStep.findUnique({
    where: { id: stepId },
    include: {
      roadmap: {
        include: {
          // #332: Sahiplik bireysel VEYA takım olabilir; tek tanımdan gelir.
          assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
        },
      },
    },
  });
}

/**
 * Adımı ve kullanıcının erişim hakkını birlikte döner; erişim yoksa null.
 * Öğrenci: bireysel sahip ya da AKTİF takım üyesi. Mentör: öğrencinin kendi
 * mentörü (#195) ya da takımın mentörü (#332).
 */
export async function adimErisimli(stepId: string, userId: string) {
  const step = await adimSahiplikBilgisi(stepId);
  if (!step) return null;
  return erisebilirMi(step.roadmap.assignedProject, userId) ? step : null;
}
