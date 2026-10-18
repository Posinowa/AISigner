import "server-only";
import { prisma } from "@/lib/db";

/**
 * Mentör profilinin görüşme bağlantısı ve admin'in başvuru görünümü için veri erişimi.
 *
 * Yetki kararları (rol, oturum kapsamı) route'ta kalır.
 */

/**
 * Mentörün görüşme bağlantısını yazar. Etkilenen satır sayısını döner:
 * 0 ise mentör profili henüz yok (#287 başvuru akışı oluşturur).
 */
export async function gorusmeLinkiniYaz(userId: string, link: string | null): Promise<number> {
  const { count } = await prisma.mentorProfile.updateMany({
    where: { userId },
    data: { gorusmeLinki: link },
  });
  return count;
}

/** Mentörün kayıtlı görüşme bağlantısı (yoksa null). */
export async function gorusmeLinkiniGetir(userId: string): Promise<string | null> {
  const profil = await prisma.mentorProfile.findUnique({
    where: { userId },
    select: { gorusmeLinki: true },
  });
  return profil?.gorusmeLinki ?? null;
}

/** Admin'in mentör başvurusunu görmesi için kullanıcının rolü ve AI rıza zamanı. */
export async function kullaniciRolVeRizasi(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, aiConsentAt: true },
  });
}

/** Mentör başvuru profili ve AI analizi (cevap vermemişse null). */
export async function mentorBasvuruProfiliniGetir(userId: string) {
  return prisma.mentorProfile.findUnique({
    where: { userId },
    select: {
      title: true,
      company: true,
      yearsExperience: true,
      seniority: true,
      expertise: true,
      capacity: true,
      weeklyHours: true,
      motivation: true,
      mentoringStyle: true,
      githubUrl: true,
      linkedinUrl: true,
      city: true,
      updatedAt: true,
      // #288: Analiz başvuruyla birlikte dönüyor.
      analysis: {
        select: {
          level: true,
          summary: true,
          strengths: true,
          technicalTracks: true,
          idealStudentProfile: true,
          matchingNotes: true,
        },
      },
    },
  });
}
