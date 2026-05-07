// features/student/server/profileSummary.ts

import { unstable_cache } from "next/cache";
import { analyzeStudentProfile } from "@/features/ai/server/profile-analysis";

export type ProfileSummaryResponse = {
  level: string;
  tracks: string[];
  summary: string;
  recommendations?: string[];
};

/**
 * Cache anahtarı: profil verisinin hash'i.
 * Profil değişmediği sürece aynı sonucu döner (Vertex AI çağrısı yapılmaz).
 * revalidate: 24 saat. Profil güncellenince revalidateTag("profile-summary-<userId>") çağır.
 */
function buildCacheKey(input: {
  experienceLevel: string;
  interests: string[];
  goals: string;
  availability?: string;
  userId?: string;
}): string[] {
  // userId varsa kişiye özel, yoksa içerik bazlı cache
  const tag = input.userId
    ? `profile-summary-${input.userId}`
    : `profile-summary-${input.experienceLevel}-${input.interests.sort().join(",")}`;
  return [tag];
}

/**
 * Profil özetini AI ile üretir ve 24 saat cache'ler.
 * Profil güncellenince revalidateTag("profile-summary-<userId>") çağırılmalı.
 */
export async function getProfileSummary(input: {
  experienceLevel: string;
  interests: string[];
  goals: string;
  availability?: string;
  userId?: string;
}): Promise<ProfileSummaryResponse> {
  const tags = buildCacheKey(input);

  const cached = unstable_cache(
    async () => {
      try {
        const result = await analyzeStudentProfile({
          experienceLevel: input.experienceLevel,
          interests: input.interests,
          goals: input.goals,
          availability: input.availability,
        });

        return {
          level: result.level,
          tracks: result.tracks,
          summary: result.summary,
          recommendations: result.recommendations,
        } satisfies ProfileSummaryResponse;
      } catch (error) {
        console.error("AI profil analizi hatası:", error);
        return getMockProfileSummary(input);
      }
    },
    tags,
    {
      revalidate: 60 * 60 * 24, // 24 saat
      tags,
    }
  );

  return cached();
}

// Yedek mock fonksiyonu (hata durumları için)
export async function getMockProfileSummary(input: {
  experienceLevel: string;
  interests: string[];
  goals: string;
}): Promise<ProfileSummaryResponse> {
  const tracks = input.interests.map((interest) => {
    if (interest.toLowerCase().includes("ai")) return "AI Başlangıç Yolu";
    if (interest.toLowerCase().includes("web")) return "Frontend Geliştirme";
    if (interest.toLowerCase().includes("data")) return "Veri Bilimi Temelleri";
    return `${interest} için Genel Öğrenme Yolu`;
  });

  const summary = `Bu kullanıcı ${input.experienceLevel} seviyesinde. İlgi alanları: ${input.interests.join(", ")}. Hedefi: ${input.goals}.`;

  return {
    level: input.experienceLevel,
    tracks,
    summary,
  };
}
