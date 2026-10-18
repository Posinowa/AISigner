import "server-only";
import { prisma } from "@/lib/db";
import { ATAMA_SAHIPLIK_SELECT } from "@/features/teams/server/sahiplik";

/**
 * Mentörün yol haritası ve adım yazma sorguları (`/api/mentor/roadmap/...`).
 *
 * Yetki kararı (mentoruMu) route'ta kalır. Adım yazmaları yol haritası kimliğiyle
 * DARALTILIR (#411): `roadmapId` olmadan adıma dokunulamaz.
 */

type AdimGuncellemeVerisi = Parameters<typeof prisma.roadmapStep.updateMany>[0]["data"];

/** Yol haritasını atama sahipliğiyle birlikte getirir (yetki kararı yok). */
export async function yolHaritasiSahipligi(roadmapId: string) {
  return prisma.roadmap.findUnique({
    where: { id: roadmapId },
    include: {
      // #332: Sahiplik bireysel VEYA takım; tek tanımdan gelir.
      assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
    },
  });
}

/** Adımı yalnız kendi yol haritası içinde bulur (#411). */
export async function adimiBul(stepId: string, roadmapId: string) {
  return prisma.roadmapStep.findFirst({ where: { id: stepId, roadmapId } });
}

/** Adımı yalnız kendi yol haritası içinde günceller; etkilenen satır sayısını döner. */
export async function adimiGuncelle(
  stepId: string,
  roadmapId: string,
  data: AdimGuncellemeVerisi,
): Promise<number> {
  const { count } = await prisma.roadmapStep.updateMany({
    where: { id: stepId, roadmapId },
    data,
  });
  return count;
}

/** Adımı yalnız kendi yol haritası içinde siler; etkilenen satır sayısını döner. */
export async function adimiSil(stepId: string, roadmapId: string): Promise<number> {
  const { count } = await prisma.roadmapStep.deleteMany({
    where: { id: stepId, roadmapId },
  });
  return count;
}
