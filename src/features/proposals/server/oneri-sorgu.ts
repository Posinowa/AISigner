import "server-only";
import { prisma } from "@/lib/db";

/** Öneriyi depo adresiyle birlikte getirir (yoksa null). */
export async function oneriDepoBilgisi(proposalId: string) {
  return prisma.projectProposal.findUnique({
    where: { id: proposalId },
    select: { repoUrl: true },
  });
}
