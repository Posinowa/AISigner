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

/**
 * Yol haritasının sonuna yeni adım ekler; sıra numarası en yüksek + 1.
 * (Sıra yeniden numaralandırma #406 tarafından yönetilir; burada yalnız sona eklenir.)
 */
export async function sonaAdimEkle(
  roadmapId: string,
  veri: {
    title: string;
    description: string;
    estimatedHours: number | null;
    resources: string[];
    githubIssueUrl: string | null;
  },
) {
  const lastStep = await prisma.roadmapStep.findFirst({
    where: { roadmapId },
    orderBy: { order: "desc" },
  });

  const newOrder = (lastStep?.order ?? 0) + 1;

  return prisma.roadmapStep.create({
    data: {
      roadmapId,
      order: newOrder,
      title: veri.title,
      description: veri.description,
      estimatedHours: veri.estimatedHours,
      resources: veri.resources,
      githubIssueUrl: veri.githubIssueUrl,
      status: "TODO",
    },
  });
}

/** Yol haritası detayı: adımlar (yorum sayısıyla) ve öğrenci/proje bilgisi. */
export async function yolHaritasiDetayi(roadmapId: string) {
  return prisma.roadmap.findUnique({
    where: { id: roadmapId },
    include: {
      steps: {
        orderBy: { order: "asc" },
        // #407: Yorum sayısı liste sorgusundan — adım başına ayrı istek N+1 olurdu.
        include: { _count: { select: { comments: true } } },
      },
      // #332: Sahiplik bireysel VEYA takım; yetki tek tanımdan gelir.
      assignedProject: {
        select: {
          ...ATAMA_SAHIPLIK_SELECT,
          projectTemplate: true,
          studentProfile: {
            include: {
              user: { select: { name: true, lastName: true, email: true } },
              mentorAssignments: { select: { mentorId: true } },
            },
          },
        },
      },
    },
  });
}

/** Yol haritası başlık/durumunu günceller ve adımlarıyla birlikte döner. */
export async function yolHaritasiGuncelle(
  roadmapId: string,
  data: { title?: string; status?: string },
) {
  const updateData: Record<string, string> = {};
  if (data.title) updateData.title = data.title;
  if (data.status) updateData.status = data.status;

  return prisma.roadmap.update({
    where: { id: roadmapId },
    data: updateData,
    include: {
      steps: {
        orderBy: { order: "asc" },
        // #407: Yorum sayısı liste sorgusundan — adım başına ayrı istek N+1 olurdu.
        include: { _count: { select: { comments: true } } },
      },
    },
  });
}
