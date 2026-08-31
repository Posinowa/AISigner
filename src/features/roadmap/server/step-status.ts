import "server-only";
import { prisma } from "@/lib/db";

/**
 * Adım durumunu değiştirir ve geçişi GEÇMİŞE yazar (#324).
 *
 * NEDEN AYRI BİR FONKSİYON: `RoadmapStep` yalnız anlık durumu ve `updatedAt`'i
 * tutuyor; bir adımın ne zaman başlayıp ne zaman bittiği hiçbir yerde yazılı
 * değildi. Planlanan analitik panel (darboğaz analizi, drop-off erken uyarısı)
 * bu veri olmadan hesaplanamaz — ve **bugün kaydedilmeyen geçiş sonsuza kadar
 * kayıptır.**
 *
 * NEDEN TRANSACTION: Durum güncellemesi başarılı olup geçmiş yazımı
 * başarısız olursa geçmiş sessizce eksilir ve bunu kimse fark etmez. İkisi
 * ya birlikte olur ya hiç olmaz.
 *
 * ⚠️ ADIM DURUMU YALNIZ BURADAN DEĞİŞTİRİLMELİ. Doğrudan
 * `prisma.roadmapStep.update({ data: { status } })` çağırmak geçmişi sessizce
 * atlar. (Şu an tek çağıran var: öğrenci adım ucu. Mentör ucu `status`
 * alanını bilerek reddediyor, provisioning yalnız `githubIssueUrl` yazıyor.)
 */
export async function adimDurumunuDegistir(params: {
  stepId: string;
  yeniDurum: string;
  oncekiDurum: string | null;
  degistirenId: string | null;
}) {
  const { stepId, yeniDurum, oncekiDurum, degistirenId } = params;

  const [guncellenen] = await prisma.$transaction([
    prisma.roadmapStep.update({
      where: { id: stepId },
      data: { status: yeniDurum as never },
    }),
    prisma.stepStatusHistory.create({
      data: {
        stepId,
        fromStatus: oncekiDurum,
        toStatus: yeniDurum,
        changedById: degistirenId,
      },
    }),
  ]);

  return guncellenen;
}
