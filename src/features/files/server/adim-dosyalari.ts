import "server-only";
import { prisma } from "@/lib/db";
import { ATAMA_SAHIPLIK_SELECT } from "@/features/teams/server/sahiplik";

/**
 * Adım dosyalarının veri erişimi (`/api/steps/[stepId]/files`).
 *
 * Yetki kararları (mezun kapısı, DRAFT/PUBLISHED, yükleyen/mentör) route'ta
 * kalır; dosyanın depolama tarafı `@/lib/storage/step-files` üzerindedir.
 */

const DOSYA_YUKLEYEN_SELECT = {
  uploader: {
    select: { id: true, name: true, lastName: true, role: true },
  },
} as const;

export async function adimDosyalariniGetir(stepId: string) {
  return prisma.stepFile.findMany({
    where: { stepId },
    orderBy: { createdAt: "desc" },
    include: DOSYA_YUKLEYEN_SELECT,
  });
}

export async function adimDosyaSayisi(stepId: string): Promise<number> {
  return prisma.stepFile.count({ where: { stepId } });
}

export async function adimDosyasiKaydet(params: {
  stepId: string;
  uploaderId: string;
  fileName: string;
  storedName: string;
  mimeType: string;
  fileSize: number;
}) {
  return prisma.stepFile.create({
    data: {
      stepId: params.stepId,
      uploaderId: params.uploaderId,
      fileName: params.fileName,
      storedName: params.storedName,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
    },
    include: DOSYA_YUKLEYEN_SELECT,
  });
}

/** Dosyayı, adımı ve sahiplik bilgisiyle birlikte getirir (yetki kararı yok). */
export async function adimDosyasiniBul(fileId: string) {
  return prisma.stepFile.findUnique({
    where: { id: fileId },
    include: {
      step: {
        include: {
          roadmap: {
            include: {
              // #332: Sahiplik bireysel VEYA takım; tek tanımdan gelir.
              assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
            },
          },
        },
      },
    },
  });
}

export async function adimDosyasiniSil(fileId: string) {
  await prisma.stepFile.delete({ where: { id: fileId } });
}
