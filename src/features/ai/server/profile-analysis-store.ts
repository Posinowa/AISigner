import { prisma } from "@/lib/db";
import { sinirla, ALAN_SINIRI } from "@/lib/ai/truncate";
import { logger } from "@/lib/logger";
import {
  analyzeStudentProfile,
  type ProfileAnalysisInput,
  type ProfileAnalysisResult,
} from "./profile-analysis";

// #47: AI profil analizini üretip öğrenci profiline bağlı kalıcı olarak saklar.

/** Kayıtlı analizi okur (yoksa null). #48 gösterimi bunu kullanır. */
export async function getStoredProfileAnalysis(studentProfileId: string) {
  return prisma.profileAnalysis.findUnique({
    where: { studentProfileId },
  });
}

/**
 * Analizi üretir ve tek satır olarak upsert eder (profil başına 1 kayıt).
 * `analyzeStudentProfile` AI hatasında güvenli fallback döndürür (asla throw etmez),
 * bu yüzden hata durumunda bile tutarlı bir analiz saklanır (AC3).
 */
export async function generateAndPersistProfileAnalysis(
  studentProfileId: string,
  input: ProfileAnalysisInput,
): Promise<ProfileAnalysisResult> {
  const result = await analyzeStudentProfile(input);

  await prisma.profileAnalysis.upsert({
    where: { studentProfileId },
    update: {
      level: result.level,
      summary: sinirla(result.summary ?? "", ALAN_SINIRI.analizMetni),
      strengths: result.strengths,
      developmentAreas: result.developmentAreas,
      technicalTracks: result.tracks,
      recommendedPath: sinirla(result.recommendedPath ?? "", ALAN_SINIRI.analizMetni),
      recommendations: result.recommendations,
    },
    create: {
      studentProfileId,
      level: result.level,
      summary: sinirla(result.summary ?? "", ALAN_SINIRI.analizMetni),
      strengths: result.strengths,
      developmentAreas: result.developmentAreas,
      technicalTracks: result.tracks,
      recommendedPath: sinirla(result.recommendedPath ?? "", ALAN_SINIRI.analizMetni),
      recommendations: result.recommendations,
    },
  });

  logger.info("Profil analizi kaydedildi", { studentProfileId, level: result.level });
  return result;
}
