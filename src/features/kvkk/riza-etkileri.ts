import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateAndPersistMentorAnalysis } from "@/features/ai/server/mentor-analysis-store";

/**
 * Rıza değişikliğinin TÜREV VERİYE etkisi (#352).
 *
 * #321 rızayı alıp geri almayı kurdu ama TÜREV VERİYİ hiç ele almadı:
 * rıza geri alındığında, o rızaya dayanarak yurt dışına gönderilmiş veriden
 * üretilmiş `MentorAnalysis` / `ProfileAnalysis` kayıtları yerinde kalıyordu.
 *
 * KVKK m.11 yalnızca "rızamı geri alıyorum" demek değil, işlemenin sonuçlarının
 * da silinmesini kapsıyor. Kaydı tutmanın pratik bir faydası da yok: #328
 * eşleştirmesi rızası olmayan mentörü zaten sıralamaya almıyor, yani veri
 * duruyor ama kullanılmıyordu — en kötü kombinasyon.
 *
 * ⚠️ SİLME BEST-EFFORT: başarısız olursa rızanın geri alınması ENGELLENMEZ.
 * Rızayı geri alamamak, türev kaydın bir süre daha durmasından çok daha ağır
 * bir ihlal olurdu. Hata loglanır.
 */

/** Rıza geri alındı: bu kullanıcıya ait AI türev kayıtlarını sil. */
export async function rizaGeriAlindiginda(userId: string): Promise<void> {
  try {
    const silinen = await prisma.mentorAnalysis.deleteMany({
      where: { mentorProfile: { userId } },
    });
    if (silinen.count > 0) {
      logger.info("Rıza geri alındı: mentör analizi silindi", { userId });
    }
  } catch (error) {
    logger.error("Rıza geri alındı ama mentör analizi silinemedi", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const silinen = await prisma.profileAnalysis.deleteMany({
      where: { studentProfile: { userId } },
    });
    if (silinen.count > 0) {
      logger.info("Rıza geri alındı: stajyer profil analizi silindi", { userId });
    }
  } catch (error) {
    logger.error("Rıza geri alındı ama stajyer analizi silinemedi", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Rıza verildi: mentörün eksik analizini üretir.
 *
 * NEDEN GEREKLİ: analiz yalnızca başvuru KAYDEDİLİRKEN üretiliyor. Rıza
 * kapısı eklendikten sonra, başvurusunu rızasız gönderip sonradan rıza veren
 * mentörün analizi hiç oluşmazdı — başvuruyu yeniden göndermedikçe. O da
 * eşleştirmeden (#328) kalıcı olarak dışlanmak demekti.
 *
 * Yalnızca EKSİK olanı üretir: var olan analizi yeniden üretmek boş yere
 * kota harcardı.
 *
 * ⚠️ Bu fonksiyon FIRLATMAZ. Çağıran taraf onu arka planda çalıştırıyor;
 * bir AI hatası rıza kaydını geri almamalı.
 */
export async function rizaVerildiginde(userId: string): Promise<void> {
  try {
    const profil = await prisma.mentorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        title: true,
        company: true,
        yearsExperience: true,
        seniority: true,
        expertise: true,
        capacity: true,
        weeklyHours: true,
        motivation: true,
        mentoringStyle: true,
        city: true,
        analysis: { select: { id: true } },
      },
    });

    // Mentör profili yok (stajyer/admin) ya da analiz zaten var.
    if (!profil || profil.analysis) return;

    await generateAndPersistMentorAnalysis(profil.id, {
      title: profil.title,
      company: profil.company ?? undefined,
      yearsExperience: profil.yearsExperience,
      seniority: profil.seniority,
      expertise: profil.expertise,
      capacity: profil.capacity,
      weeklyHours: profil.weeklyHours,
      motivation: profil.motivation,
      mentoringStyle: profil.mentoringStyle,
      city: profil.city ?? undefined,
    });

    logger.info("Rıza verildi: eksik mentör analizi üretildi", { userId });
  } catch (error) {
    logger.error("Rıza verildi ama mentör analizi üretilemedi", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
