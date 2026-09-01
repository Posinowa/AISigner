import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";
import { createRateLimiter } from "@/lib/rate-limit";
import { profilSahibininRizasiVar } from "@/features/kvkk/riza";
import {
  mentorleriSirala,
  type MentorAdayi,
  type Uyum,
} from "@/features/ai/server/mentor-matching";

/**
 * Mentör önerisi (#328).
 *
 * ÖNERİ ÖNERİDİR: bu modül hiçbir atama YAPMAZ. Sonuç admin'e sunulur, atama
 * kararı ve `setStudentMentors` çağrısı admin'de kalır. Otomatik atamak,
 * insanın gözden geçirdiği bir kararı sessizce modele devretmek olurdu.
 *
 * KAPSAM DIŞI BIRAKILANLARI SAYIYORUZ: analizi olmayan ya da rızası olmayan
 * mentörler sıralamaya hiç girmiyor. Bu sayılar çağırana DÖNDÜRÜLÜYOR, çünkü
 * "en uygun 3 mentör" ifadesi, adayların yarısı elenmişken yanıltıcı olur —
 * admin neyin arasından seçildiğini bilmeli.
 */

/** Öneri üretimi ücretli bir AI çağrısı; admin başına makul tavan. */
const limiter = createRateLimiter("mentor-matching", {
  maxRequests: 30,
  windowSeconds: 60 * 60,
});

export type OneriHatasi =
  | "ogrenci-yok"
  | "profil-yok"
  | "riza-yok"
  | "aday-yok"
  | "tavan-doldu"
  | "ai-hatasi";

export type MentorOnerisi = {
  mentorId: string;
  ad: string | null;
  soyad: string | null;
  email: string;
  uyum: Uyum;
  gerekce: string;
  cekince: string | null;
  /** Bu mentör öğrenciye zaten atanmış mı? (#195 — M:N) */
  zatenAtanmis: boolean;
};

export type OneriSonucu =
  | {
      ok: true;
      oneriler: MentorOnerisi[];
      /** Şeffaflık: sıralamaya kaç aday girdi, kaçı neden elendi. */
      degerlendirilen: number;
      analiziOlmayan: number;
      rizasiOlmayan: number;
    }
  | { ok: false; neden: OneriHatasi; mesaj?: string };

export async function mentorOnerisiUret(params: {
  studentUserId: string;
  adminUserId: string;
}): Promise<OneriSonucu> {
  const ogrenci = await prisma.user.findUnique({
    where: { id: params.studentUserId },
    select: {
      role: true,
      studentProfile: {
        select: {
          id: true,
          experienceLevel: true,
          interests: true,
          goals: true,
          profileAnalysis: {
            select: {
              summary: true,
              strengths: true,
              developmentAreas: true,
              technicalTracks: true,
            },
          },
          mentorAssignments: { select: { mentorId: true } },
        },
      },
    },
  });

  if (!ogrenci || ogrenci.role !== "STUDENT") {
    return { ok: false, neden: "ogrenci-yok" };
  }
  if (!ogrenci.studentProfile) {
    return { ok: false, neden: "profil-yok" };
  }

  // KVKK: öğrencinin profil verisi Vertex AI'ya (ABD) gidecek. İşlemi admin
  // tetikliyor ama veri ÖĞRENCİYE ait — rıza da öğrencinin (#321; aynı gerekçe
  // `generate-roadmap` ve `ai-recommend-projects` uçlarında da geçerli).
  if (!(await profilSahibininRizasiVar(ogrenci.studentProfile.id))) {
    return { ok: false, neden: "riza-yok" };
  }

  const rl = await limiter.check(params.adminUserId);
  if (!rl.allowed) {
    incrementCounter("ai.mentor-matching.tavan");
    return { ok: false, neden: "tavan-doldu" };
  }

  // Analizi olan mentörler: sıralamanın anlamsal malzemesi bu (#288).
  const analizler = await prisma.mentorAnalysis.findMany({
    select: {
      level: true,
      summary: true,
      strengths: true,
      technicalTracks: true,
      idealStudentProfile: true,
      matchingNotes: true,
      mentorProfile: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              lastName: true,
              email: true,
              role: true,
              aiConsentAt: true,
            },
          },
        },
      },
    },
  });

  const toplamMentor = await prisma.user.count({ where: { role: "MENTOR" } });

  // Rol değişmiş olabilir: MENTOR olmayanın analizi sıralamaya girmemeli.
  const mentorAnalizleri = analizler.filter((a) => a.mentorProfile.user.role === "MENTOR");

  // KVKK — MENTÖR TARAFI: mentörün analizi de kişisel veridir ve o da yurt
  // dışına gidiyor. Rızası olmayan mentör sıralamaya alınmıyor.
  //
  // ⚠️ Bu, analizin ÜRETİMİNDEN daha sıkı: `basvuru.ts` analizi rıza kontrolü
  // yapmadan üretiyor (mevcut boşluk, ayrıca ele alınmalı). Burada aynı
  // boşluğu tekrarlamamayı seçtik; eleme SESSİZ değil, sayısı döndürülüyor.
  const rizali = mentorAnalizleri.filter((a) => Boolean(a.mentorProfile.user.aiConsentAt));

  const analiziOlmayan = Math.max(0, toplamMentor - mentorAnalizleri.length);
  const rizasiOlmayan = mentorAnalizleri.length - rizali.length;

  if (rizali.length === 0) {
    return { ok: false, neden: "aday-yok" };
  }

  const adaylar: MentorAdayi[] = rizali.map((a) => ({
    mentorId: a.mentorProfile.user.id,
    seviye: a.level,
    ozet: a.summary,
    guclüYonler: a.strengths,
    teknikAlanlar: a.technicalTracks,
    idealStajyerProfili: a.idealStudentProfile,
    eslestirmeNotlari: a.matchingNotes,
  }));

  const p = ogrenci.studentProfile;
  let siralama;
  try {
    siralama = await mentorleriSirala(
      {
        deneyimSeviyesi: p.experienceLevel,
        ilgiAlanlari: p.interests,
        hedefler: p.goals,
        analizOzeti: p.profileAnalysis?.summary ?? null,
        guclüYonler: p.profileAnalysis?.strengths ?? [],
        gelisimAlanlari: p.profileAnalysis?.developmentAreas ?? [],
        teknikAlanlar: p.profileAnalysis?.technicalTracks ?? [],
      },
      adaylar,
    );
  } catch (error) {
    // YEDEK SIRALAMAYA DÜŞMÜYORUZ. Uydurulmuş bir "en uygun mentör" listesi,
    // admin'in gerçek bir öneriden ayırt edemeyeceği bir karar girdisi olurdu.
    logger.error("Mentör önerisi üretilemedi", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      neden: "ai-hatasi",
      mesaj: error instanceof Error ? error.message : undefined,
    };
  }

  // Modelin uydurduğu kimlikleri ELE. Prompt "listede olmayan kimlik uydurma"
  // diyor ama bu bir talimat, garanti değil; eşleşmeyen kimlik arayüzde
  // "bilinmeyen mentör" satırı olarak görünürdü.
  const adayHaritasi = new Map(rizali.map((a) => [a.mentorProfile.user.id, a.mentorProfile.user]));
  const atanmisIdler = new Set(p.mentorAssignments.map((m) => m.mentorId));

  const oneriler: MentorOnerisi[] = [];
  for (const o of siralama.oneriler) {
    const kullanici = adayHaritasi.get(o.mentorId);
    if (!kullanici) {
      incrementCounter("ai.mentor-matching.uydurma-kimlik");
      logger.warn("Mentör önerisinde tanınmayan kimlik atlandı", { mentorId: o.mentorId });
      continue;
    }
    oneriler.push({
      mentorId: kullanici.id,
      ad: kullanici.name,
      soyad: kullanici.lastName,
      email: kullanici.email,
      uyum: o.uyum,
      gerekce: o.gerekce,
      cekince: o.cekince ?? null,
      zatenAtanmis: atanmisIdler.has(kullanici.id),
    });
  }

  incrementCounter("ai.mentor-matching.uretildi");
  return {
    ok: true,
    oneriler,
    degerlendirilen: adaylar.length,
    analiziOlmayan,
    rizasiOlmayan,
  };
}
