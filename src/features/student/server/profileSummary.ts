// features/student/server/profileSummary.ts

import { unstable_cache } from "next/cache";
import { analyzeStudentProfile } from "@/features/ai/server/profile-analysis";
import { experienceLevelLabel } from "@/lib/experience-level";
import { aiRizasiVar } from "@/features/kvkk/riza";

/**
 * #282: AI çağrısı için üst sınır.
 *
 * Gemini istemcisinde timeout/AbortController yok; yavaşlarsa veya asılırsa
 * sayfa süresiz bekliyordu. Mevcut yedek (mock özet) yalnızca hata
 * FIRLATILDIĞINDA devreye giriyordu — asılma durumunda değil.
 *
 * Süre BİLEREK cömert. Kart artık akış sınırının içinde (#282), yani sayfa
 * beklemiyor; zaman aşımının işi hızı zorlamak değil, sonsuz asılmayı
 * önlemek. Ölçümde gerçek Gemini çağrısı ~10 sn sürüyor — daha kısa bir
 * sınır kullanıcıyı sessizce mock özete düşürür ve özelliği bozardı.
 */
const AI_ZAMAN_ASIMI_MS = 25000;

/** `islem` süreyi aşarsa `yedek` döner. İptal edilemeyen çağrıyı beklemez. */
async function zamanAsimiyla<T>(
  islem: Promise<T>,
  yedek: () => T | Promise<T>,
  ms: number = AI_ZAMAN_ASIMI_MS,
): Promise<T> {
  let zamanlayici: ReturnType<typeof setTimeout> | undefined;

  const bekcı = new Promise<"zaman-asimi">((cozumle) => {
    zamanlayici = setTimeout(() => cozumle("zaman-asimi"), ms);
  });

  try {
    const sonuc = await Promise.race([islem, bekcı]);
    if (sonuc === "zaman-asimi") {
      console.warn(`AI profil analizi ${ms}ms icinde yanit vermedi; yedek ozete dusuldu.`);
      return await yedek();
    }
    return sonuc as T;
  } finally {
    if (zamanlayici) clearTimeout(zamanlayici);
  }
}

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
        // #321: KVKK açık rıza yoksa profil verisi Vertex AI'ya (ABD)
        // GÖNDERİLMEZ. Mock özet gösteriliyor — panel boş kalmasın diye — ve
        // bu içerik zaten "AI üretimi" iddiasında bulunmuyor.
        if (input.userId && !(await aiRizasiVar(input.userId))) {
          return getMockProfileSummary(input);
        }

        const result = await zamanAsimiyla(
          analyzeStudentProfile({
            experienceLevel: input.experienceLevel,
            interests: input.interests,
            goals: input.goals,
            availability: input.availability,
          }),
          () => getMockProfileSummary(input),
        );

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

  const levelLabel = experienceLevelLabel(input.experienceLevel);
  const summary = `Bu kullanıcı ${levelLabel} seviyesinde. İlgi alanları: ${input.interests.join(", ")}. Hedefi: ${input.goals}.`;

  return {
    level: levelLabel,
    tracks,
    summary,
  };
}
