import "server-only";
import { prisma } from "@/lib/db";
import { sinirla, ALAN_SINIRI } from "@/lib/ai/truncate";
import {
  analyzeMentorProfile,
  type MentorAnalysisInput,
} from "@/features/ai/server/mentor-analysis";

/**
 * #288: Mentör analizinin üretilmesi ve kalıcı saklanması.
 *
 * `profile-analysis-store` (stajyer) ile aynı desen. Analiz başvuru
 * kaydedilirken ÜRETİLİR, admin panelinde okunurken değil: admin onay
 * ekranında bekletilmemeli ve aynı analiz her açılışta yeniden üretilip
 * kota harcamamalı.
 */

export async function getStoredMentorAnalysis(mentorProfileId: string) {
  return prisma.mentorAnalysis.findUnique({ where: { mentorProfileId } });
}

export async function generateAndPersistMentorAnalysis(
  mentorProfileId: string,
  input: MentorAnalysisInput,
) {
  const sonuc = await analyzeMentorProfile(input);

  // Başvuru güncellenebiliyor; analiz de güncellenmeli, yoksa admin eski
  // cevaplara göre üretilmiş bir değerlendirme okurdu.
  return prisma.mentorAnalysis.upsert({
    where: { mentorProfileId },
    update: {
      level: sonuc.level,
      summary: sinirla(sonuc.summary ?? "", ALAN_SINIRI.analizMetni),
      strengths: sonuc.strengths,
      technicalTracks: sonuc.technicalTracks,
      idealStudentProfile: sinirla(sonuc.idealStudentProfile ?? "", ALAN_SINIRI.analizMetni),
      matchingNotes: sonuc.matchingNotes,
    },
    create: {
      mentorProfileId,
      level: sonuc.level,
      summary: sinirla(sonuc.summary ?? "", ALAN_SINIRI.analizMetni),
      strengths: sonuc.strengths,
      technicalTracks: sonuc.technicalTracks,
      idealStudentProfile: sinirla(sonuc.idealStudentProfile ?? "", ALAN_SINIRI.analizMetni),
      matchingNotes: sonuc.matchingNotes,
    },
  });
}
