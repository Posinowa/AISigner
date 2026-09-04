import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { IlerlemeOzeti } from "@/features/progress/ilerleme";

/**
 * Yol haritası başına adım özeti — TOPLAMA VERİTABANINDA (#452).
 *
 * ⚠️ NEDEN HAM SQL: Prisma `groupBy` sayıları ve `MAX(updatedAt)`'i
 * verebiliyor ama "grubun EN SON güncellenen adımının BAŞLIĞI"nı ifade
 * edemiyor (grup başına ilk satır — `DISTINCT ON` / pencere fonksiyonu
 * karşılığı yok). İkinci bir sorgu açmak yerine tek `ARRAY_AGG ... ORDER BY`
 * kullanıldı; sonuç yol haritası başına TEK satır.
 *
 * ⚠️ EŞİTLİK BELİRLİ BİR ŞEKİLDE ÇÖZÜLÜYOR (`order DESC`). Öncesinde
 * sıralama yalnız `updatedAt DESC` idi ve ikincil anahtar YOKTU: aynı anda
 * güncellenmiş iki adımda hangisinin "son hareket" sayılacağı veritabanının
 * satır sırasına kalıyordu — aynı veriye iki kez sorulunca farklı cevap
 * gelebilir. #406'da adım sıralaması için verilen kararın aynısı; orada da
 * bozuk veride aynı düğmeye iki kez basmanın farklı sonuç vermesi kabul
 * edilmemişti. Eşitlikte yol haritasında DAHA İLERİDEKİ adım seçiliyor.
 *
 * ⚠️ BURADA İŞ KURALI YOK — bu yüzden #376'daki "kural iki dilde yaşıyor"
 * borcu tekrarlanmıyor. Sorgu yalnız ham sayıları topluyor; yüzde formülü,
 * %100 istisnası ve sessizlik eşiği hâlâ tek yerde, `progress/ilerleme.ts`
 * içinde. Yetki/kapsam da burada değil: hangi yol haritalarının sorulacağına
 * çağıran karar veriyor, kimlikleri o süzüyor.
 */
export type AdimOzeti = IlerlemeOzeti & {
  /** En son güncellenen adımın başlığı. Adım yoksa null. */
  sonBaslik: string | null;
};

type SatirTipi = {
  roadmapId: string;
  toplam: bigint | number;
  tamamlanan: bigint | number;
  sonHareket: Date | null;
  sonBaslik: string | null;
};

export const BOS_OZET: AdimOzeti = {
  toplamAdim: 0,
  tamamlanan: 0,
  sonHareketAt: null,
  sonBaslik: null,
};

/**
 * Verilen yol haritalarının adım özetlerini döndürür.
 *
 * Yol haritası kimliği listede olup hiç adımı yoksa haritada YER ALMAZ;
 * çağıran `BOS_OZET`'e düşer ("adım yok" ile "hiç ilerlemedi" ayrımı
 * çağırana ait — #432).
 */
export async function adimOzetleriniGetir(
  roadmapIds: string[],
): Promise<Map<string, AdimOzeti>> {
  const harita = new Map<string, AdimOzeti>();
  // Boş `IN ()` geçersiz SQL — sorguyu hiç açma.
  if (roadmapIds.length === 0) return harita;

  const satirlar = await prisma.$queryRaw<SatirTipi[]>`
    SELECT s."roadmapId"                                            AS "roadmapId",
           COUNT(*)::int                                            AS "toplam",
           COUNT(*) FILTER (WHERE s."status"::text = 'COMPLETED')::int AS "tamamlanan",
           MAX(s."updatedAt")                                       AS "sonHareket",
           (ARRAY_AGG(s."title" ORDER BY s."updatedAt" DESC, s."order" DESC))[1] AS "sonBaslik"
    FROM "RoadmapStep" s
    WHERE s."roadmapId" IN (${Prisma.join(roadmapIds)})
    GROUP BY s."roadmapId"
  `;

  for (const r of satirlar) {
    harita.set(r.roadmapId, {
      toplamAdim: Number(r.toplam),
      tamamlanan: Number(r.tamamlanan),
      sonHareketAt: r.sonHareket,
      sonBaslik: r.sonBaslik,
    });
  }
  return harita;
}
