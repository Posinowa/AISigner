import "server-only";
import { prisma } from "@/lib/db";
import { ATAMA_SAHIPLIK_SELECT } from "@/features/teams/server/sahiplik";

/**
 * Yol haritası üretimi ve AI adım ekleme için veri erişimi
 * (`/api/mentor/generate-roadmap`, `/api/mentor/roadmap/[roadmapId]/ai-step`).
 *
 * Yetki, rıza ve AI çağrısı route'larda kalır.
 */

/** Atanmış projeyi, öğrenci profilini ve mevcut yol haritasını birlikte getirir. */
export async function atamaVeYolHaritasi(assignedProjectId: string) {
  return prisma.assignedProject.findUnique({
    where: { id: assignedProjectId },
    include: {
      // #332: Sahiplik bireysel VEYA takım; yetki tek tanımdan gelir.
      // `generateRoadmap` TAM profili istediği için studentProfile ayrıca
      // bütünüyle çekiliyor (takım dalı aşağıda erken dönüyor).
      ...ATAMA_SAHIPLIK_SELECT,
      studentProfile: { include: { mentorAssignments: { select: { mentorId: true } } } },
      projectTemplate: true,
      roadmap: true, // Zaten bir yol haritası var mı diye kontrol etmek için
    },
  });
}

/** Taslak yol haritasını siler (yeniden üretim için). */
export async function yolHaritasiniSil(roadmapId: string) {
  await prisma.roadmap.delete({
    where: { id: roadmapId },
  });
}

export type UretilenAdim = {
  order: number;
  title: string;
  description: string;
  estimatedHours: number | null;
  resources: string[];
};

/** Atanmış proje için TASLAK yol haritasını ve adımlarını tek işlemde yazar. */
export async function yolHaritasiOlustur(params: {
  assignedProjectId: string;
  title: string;
  adimlar: UretilenAdim[];
}) {
  return prisma.roadmap.create({
    data: {
      assignedProjectId: params.assignedProjectId,
      title: params.title,
      status: "DRAFT", // Mentör onayına sunmak için önce taslak olarak kaydedilir
      steps: {
        create: params.adimlar.map((step) => ({
          order: step.order,
          title: step.title,
          description: step.description,
          estimatedHours: step.estimatedHours,
          resources: step.resources,
          status: "TODO",
        })),
      },
    },
    include: {
      steps: true, // Frontend'e oluşturulan adımları da geri dönüyoruz
    },
  });
}

/** AI adım ekleme için yol haritası, adımları ve öğrenci profili. */
export async function yolHaritasiVeOgrenci(roadmapId: string) {
  return prisma.roadmap.findUnique({
    where: { id: roadmapId },
    include: {
      steps: { orderBy: { order: "asc" } },
      // #332: Sahiplik bireysel VEYA takım; yetki tek tanımdan gelir.
      // Prompt'ta öğrenci adı/seviyesi kullanıldığı için profil tümüyle
      // çekiliyor (takım dalı yukarıda erken dönüyor).
      assignedProject: {
        select: {
          ...ATAMA_SAHIPLIK_SELECT,
          studentProfile: { include: { user: true, mentorAssignments: { select: { mentorId: true } } } },
          projectTemplate: true,
        },
      },
    },
  });
}

/** Yol haritasına tek adım ekler (AI üretimi). */
export async function adimEkle(params: {
  roadmapId: string;
  order: number;
  title: string;
  description: string;
  estimatedHours: number | null;
  resources: string[];
}) {
  return prisma.roadmapStep.create({
    data: {
      roadmapId: params.roadmapId,
      order: params.order,
      title: params.title,
      description: params.description,
      estimatedHours: params.estimatedHours,
      resources: params.resources,
      status: "TODO",
    },
  });
}
