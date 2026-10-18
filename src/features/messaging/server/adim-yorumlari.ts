import "server-only";
import { prisma } from "@/lib/db";

/**
 * Adım yorumlarının veri erişimi (`/api/steps/[stepId]/comments`).
 *
 * Yetki kararları (mezun kapısı, DRAFT/PUBLISHED, sahiplik) route'ta ya da
 * `sahiplik.ts`'te kalır; bu modül sorguları ve adım sahipliği bilgisini taşır.
 */

const YORUM_YAZAR_SELECT = {
  author: {
    select: { id: true, name: true, lastName: true, role: true },
  },
} as const;

export async function adimYorumlariniGetir(stepId: string) {
  return prisma.stepComment.findMany({
    where: { stepId },
    orderBy: { createdAt: "asc" },
    include: YORUM_YAZAR_SELECT,
  });
}

export async function adimYorumuEkle(params: {
  stepId: string;
  authorId: string;
  content: string;
}) {
  return prisma.stepComment.create({
    data: {
      stepId: params.stepId,
      authorId: params.authorId,
      content: params.content,
    },
    include: YORUM_YAZAR_SELECT,
  });
}

export async function yorumuBul(commentId: string) {
  return prisma.stepComment.findUnique({
    where: { id: commentId },
  });
}

export async function yorumuGuncelle(commentId: string, content: string) {
  return prisma.stepComment.update({
    where: { id: commentId },
    data: { content },
    include: YORUM_YAZAR_SELECT,
  });
}

export async function yorumuSil(commentId: string) {
  await prisma.stepComment.delete({ where: { id: commentId } });
}
