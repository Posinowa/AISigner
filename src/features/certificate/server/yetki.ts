import "server-only";
import { prisma } from "@/lib/db";
import { mentorunOgrencisiWhere } from "@/features/teams/server/sahiplik";

/**
 * Mentörün, öğrencinin sertifikasını görme hakkı için sahiplik sorgusu (#204, #370).
 * Sertifika BİREYSEL kalır (#332); takım mentörü de üyenin belgesini görebilir.
 * Döner: öğrenci profili (sahiplik varsa), yoksa null.
 */
export async function mentorunOgrencisiProfili(studentUserId: string, mentorId: string) {
  return prisma.studentProfile.findFirst({
    where: {
      userId: studentUserId,
      ...mentorunOgrencisiWhere(mentorId),
    },
    select: { id: true },
  });
}
