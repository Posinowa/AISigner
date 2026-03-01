// features/student/server/profileSummary.ts

import { analyzeStudentProfile } from '@/features/ai/server/profile-analysis';

export type ProfileSummaryResponse = {
  level: string;
  tracks: string[];
  summary: string;
  recommendations?: string[];
};

// Gerçek AI ile profil analizi
export async function getProfileSummary(input: {
  experienceLevel: string;
  interests: string[];
  goals: string;
  availability?: string;
}): Promise<ProfileSummaryResponse> {
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
    };
  } catch (error) {
    console.error('AI profil analizi hatası:', error);
    
    // Hata durumunda basit bir özet döndür
    return getMockProfileSummary(input);
  }
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