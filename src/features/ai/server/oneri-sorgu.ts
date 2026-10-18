import "server-only";
import { prisma } from "@/lib/db";
import { mentorunOgrencisiWhere, ogrencininAtamalariWhere } from "@/features/teams/server/sahiplik";

/**
 * Mentörün proje önerisi için veri sorguları (`/api/mentor/ai-recommend-projects`).
 *
 * Yetki ve rıza kararları route'ta kalır; burada yalnız sorgular var.
 */

/** Öğrenci profili, yalnız bu mentöre bağlıysa (#370: bireysel VEYA takım). */
export async function mentorunOgrencisiProfili(studentProfileId: string, mentorUserId: string | undefined) {
  return prisma.studentProfile.findFirst({
    where: {
      id: studentProfileId,
      ...mentorunOgrencisiWhere(mentorUserId!),
    },
  });
}

/** Öğrencinin mevcut atamaları (tekrarlanabilirlik bilgisiyle). */
export async function ogrencininAtamalari(studentProfileId: string) {
  return prisma.assignedProject.findMany({
    where: ogrencininAtamalariWhere(studentProfileId),
    // #503: Tekrarlanabilir şablonlar bu elemeden MUAF.
    select: { projectTemplateId: true, projectTemplate: { select: { tekrarlanabilir: true } } },
  });
}

/** Önerilebilir şablon havuzu: öneriden türemeyenler ve henüz atanmamışlar. */
export async function oneriSablonHavuzu(atanmisIdler: string[]) {
  return prisma.projectTemplate.findMany({
    where: {
      // #366: Öneriden türeyen şablonlar başka öğrencilere ÖNERİLMEZ.
      fromProposal: false,
      ...(atanmisIdler.length ? { id: { notIn: atanmisIdler } } : {}),
    },
  });
}

/** Mentörün uzmanlık ve kıdem bilgisi (#295). */
export async function mentorUzmanlikProfili(mentorUserId: string | undefined) {
  return prisma.mentorProfile.findUnique({
    where: { userId: mentorUserId },
    select: { expertise: true, seniority: true },
  });
}
