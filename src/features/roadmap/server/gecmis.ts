import "server-only";
import { prisma } from "@/lib/db";
import { ogrencininAtamalariWhere } from "@/features/teams/server/sahiplik";

/**
 * Öğrencinin ÖNCEKİ projelerinde tamamladığı adım başlıkları (#423).
 *
 * ⚠️ NEDEN: İkinci projesinde stajyer yine "Proje Kurulumu ve Gerekli
 * Araçlar" adımını alıyordu. Tamamlanmış adımlar prompt'a hiç girmediği için
 * tekrar kaçınılmazdı.
 *
 * ⚠️ SAHİPLİK `sahiplik.ts`'ten soruluyor: takım atamasında
 * `studentProfileId` NULL, yalnız eşitliğe bakan bir sorgu takım projelerini
 * komple elerdi (#332 — bu kod tabanında dört kez yaşanmış hata sınıfı).
 *
 * ⚠️ YALNIZ BAŞLIK okunuyor, açıklama değil: tekrarı önlemek için başlık
 * yeterli ve prompt bütçesi korunuyor.
 */
export async function tamamlananAdimBasliklari(params: {
  studentProfileId: string;
  /** Şu an yol haritası üretilen atama — kendi adımları geçmiş sayılmaz. */
  haricAtamaId: string;
  azami: number;
}): Promise<string[]> {
  const adimlar = await prisma.roadmapStep.findMany({
    where: {
      status: "COMPLETED",
      roadmap: {
        assignedProjectId: { not: params.haricAtamaId },
        assignedProject: ogrencininAtamalariWhere(params.studentProfileId),
      },
    },
    // En yeni tamamlananlar: tekrar riskinin en yüksek olduğu yer yakın geçmiş.
    orderBy: { updatedAt: "desc" },
    take: params.azami,
    select: { title: true },
  });

  // Aynı başlık birden çok projede geçebilir; tekilleştiriliyor.
  return [...new Set(adimlar.map((a) => a.title))];
}
