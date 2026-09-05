import "server-only";
import { prisma } from "@/lib/db";

/**
 * Proje şablonu başına "şu an kaç stajyer çalışıyor" — TEK KAYNAK (#499).
 *
 * ⚠️ NEDEN VAR: Mentör bir projeyi atarken o proje üzerinde kaç kişinin
 * çalıştığını göremiyordu ve AI önerisi de bunu hesaba katmıyordu. Ölçüldü —
 * dağılım gerçekten çarpık: iki şablon aktif atamaların çoğunu taşırken
 * diğerleri boş duruyordu. Ne mentör ne AI bunu görebildiği için kimse
 * dengeleyemiyordu.
 *
 * ⚠️ ATAMAYI ENGELLEMEZ. Aynı projeyi birden çok stajyerin yapması meşru
 * (farklı dönem, farklı seviye, karşılaştırmalı değerlendirme). Sayı yalnız
 * kararı BİLGİLENDİRİR — #404'te mentör kapasitesi için verilen kararın
 * aynısı ("dolu/aşkın mentör engellenmez, son söz admin'in").
 */

/**
 * ⚠️ NEYİ SAYIYOR — üç bilinçli karar:
 *
 * 1. **KİŞİ sayıyor, atama değil.** Takım ataması TEK satırdır ama üzerinde
 *    birden çok stajyer çalışır; mentörün sorduğu soru "kaç kişi" olduğu için
 *    takımın aktif üyeleri tek tek sayılıyor. (Ayrılmış üye sayılmaz.)
 *
 * 2. **TAMAMLANMAMIŞ atamalar.** `PENDING` de sayılıyor: proje atanmış ama
 *    başlanmamış olabilir — yine de o stajyer o projeye "ayrılmış" durumda ve
 *    şablon o kadar dolu. `COMPLETED` sayılmıyor; biten iş yük değildir.
 *
 * 3. **MEZUN VE REDDEDİLEN SAYILMAZ.** Sayı EŞZAMANLI yükü anlatır; aksi
 *    halde eski dönemlerin stajyerleri şablonu kalıcı olarak "dolu"
 *    gösterirdi. #404'teki kapasite sayımıyla aynı gerekçe.
 */
export type ProjeYuku = { projectTemplateId: string; kisi: number };

/**
 * Tüm şablonların yükünü tek sorguda döndürür.
 *
 * ⚠️ TOPLAMA VERİTABANINDA (#313 dersi). Atamaları çekip JS'te saymak şablon
 * ve stajyer sayısıyla büyürdü; burada dönen satır sayısı ŞABLON sayısı
 * kadar — atama sayısından bağımsız.
 */
export async function projeYukleriniGetir(): Promise<Map<string, number>> {
  const satirlar = await prisma.$queryRaw<{ tid: string; kisi: bigint | number }[]>`
    SELECT k."projectTemplateId" AS "tid",
           COUNT(DISTINCT k."studentProfileId")::int AS "kisi"
    FROM (
      -- Bireysel atamalar: stajyerin kendisi.
      SELECT ap."projectTemplateId", ap."studentProfileId"
      FROM "AssignedProject" ap
      JOIN "StudentProfile" sp ON sp.id = ap."studentProfileId"
      JOIN "User" u ON u.id = sp."userId"
      WHERE ap."status"::text <> 'COMPLETED'
        AND u."accountStatus"::text NOT IN ('GRADUATED', 'REJECTED')

      UNION ALL

      -- Takım atamaları: takımın AKTİF üyeleri tek tek.
      SELECT ap."projectTemplateId", tm."studentProfileId"
      FROM "AssignedProject" ap
      JOIN "TeamMember" tm ON tm."teamId" = ap."teamId" AND tm."leftAt" IS NULL
      JOIN "StudentProfile" sp ON sp.id = tm."studentProfileId"
      JOIN "User" u ON u.id = sp."userId"
      WHERE ap."status"::text <> 'COMPLETED'
        AND u."accountStatus"::text NOT IN ('GRADUATED', 'REJECTED')
    ) k
    GROUP BY k."projectTemplateId"
  `;

  const harita = new Map<string, number>();
  for (const r of satirlar) harita.set(r.tid, Number(r.kisi));
  return harita;
}
