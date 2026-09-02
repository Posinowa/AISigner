import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
// #376: Sahiplik kuralının SQL karşılıkları TEK dosyada. Ham sorgular buradan
// geçmeli; kural iki dilde yaşamak zorunda ama iki yerde YAZILMAMALI.
import {
  atamaOgrencininSql,
  mentorunAtamasiSql,
  mentorunOgrencisiSql,
} from "@/features/teams/server/sahiplik-sql";

/**
 * Analitik panel sorguları (#331).
 *
 * ⚠️ DROP-OFF RİSKİ AI İLE ÜRETİLMİYOR — bilinçli.
 *
 * Issue "AI ile üretilecekse gerekçesi görünür olmalı" diyordu. Bir adım öteye
 * gidip AI'ı hiç kullanmıyoruz: risk, AÇIK KURALLARLA hesaplanıyor ve mentöre
 * skor değil SİNYALLERİN KENDİSİ gösteriliyor ("14 gündür hiç hareket yok",
 * "3. adım 9 gündür açık"). Gerekçe böylece bir açıklama metni değil, verinin
 * ta kendisi oluyor.
 *
 * Sebep #328'dekiyle aynı: bir insan hakkındaki yargıya uydurma bir kesinlik
 * eklemek, onu okuyanı sorgulamadan güvenmeye iter. "Bırakma riski %73" cümlesi
 * ölçülmüş hiçbir şeye dayanmaz; "14 gündür hareket yok" ise doğrulanabilir.
 *
 * ⚠️ SORGU MALİYETİ: bu panel toplama sorguları üretiyor. Üçü de TEK sorgu ve
 * veritabanı içinde toplanıyor — satırları çekip JS'te gruplamak, öğrenci
 * sayısıyla birlikte bağlantı havuzunu tıkardı (#313'teki N+1 dersi).
 */

/** Bir adımın "takılmış" sayılması için geçmesi gereken gün. */
export const TAKILMA_GUN = 7;

/** Öğrencinin "sessiz" sayılması için geçmesi gereken gün. */
export const SESSIZLIK_GUN = 10;

export type DarbogazSatiri = {
  projeBasligi: string;
  adimSirasi: number;
  adimBasligi: string;
  tamamlayanSayisi: number;
  ortalamaGun: number;
  ortancaGun: number;
};

type DarbogazHam = {
  projeBasligi: string;
  adimSirasi: number;
  adimBasligi: string;
  tamamlayanSayisi: bigint;
  ortalamaSaat: number | null;
  ortancaSaat: number | null;
};

/**
 * Hangi adım ne kadar sürüyor?
 *
 * Gruplama PROJE + ADIM SIRASI üzerinden: yol haritası adımları öğrenciye özel
 * üretildiği için BAŞLIKLAR birbirini tutmuyor ve başlığa göre gruplamak
 * neredeyse hep tek elemanlı kümeler verirdi. "Blog API'nin 3. adımı" ise
 * öğrenciler arasında karşılaştırılabilir bir birim.
 *
 * Süre = son `IN_PROGRESS` → son `COMPLETED`. Bir adım durdurulup yeniden
 * başlatılabildiği için "son" alınıyor; ilk başlangıcı almak, arada geçen ölü
 * zamanı da süreye yazardı.
 *
 * ORTANCA da dönüyor: tek bir öğrencinin bıraktığı adım ortalamayı uçurur,
 * ortanca dayanıklıdır. Panelde sıralama ortancaya göre.
 */
export async function darbogazAnalizi(mentorUserId?: string): Promise<DarbogazSatiri[]> {
  const satirlar = await prisma.$queryRaw<DarbogazHam[]>`
    WITH gecisler AS (
      SELECT h."stepId",
             h."toStatus",
             h."createdAt",
             ROW_NUMBER() OVER (
               PARTITION BY h."stepId", h."toStatus" ORDER BY h."createdAt" DESC
             ) AS sira
      FROM "StepStatusHistory" h
      WHERE h."toStatus" IN ('IN_PROGRESS', 'COMPLETED')
    ),
    sureler AS (
      SELECT b."stepId",
             EXTRACT(EPOCH FROM (t."createdAt" - b."createdAt")) / 3600 AS saat
      FROM gecisler b
      JOIN gecisler t
        ON t."stepId" = b."stepId" AND t."toStatus" = 'COMPLETED' AND t.sira = 1
      WHERE b."toStatus" = 'IN_PROGRESS'
        AND b.sira = 1
        AND t."createdAt" > b."createdAt"
    )
    SELECT pt."title"                                                    AS "projeBasligi",
           st."order"                                                    AS "adimSirasi",
           MIN(st."title")                                               AS "adimBasligi",
           COUNT(*)                                                      AS "tamamlayanSayisi",
           AVG(su.saat)                                                  AS "ortalamaSaat",
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY su.saat)          AS "ortancaSaat"
    FROM sureler su
    JOIN "RoadmapStep" st       ON st.id = su."stepId"
    JOIN "Roadmap" rm           ON rm.id = st."roadmapId"
    JOIN "AssignedProject" ap   ON ap.id = rm."assignedProjectId"
    JOIN "ProjectTemplate" pt   ON pt.id = ap."projectTemplateId"
    -- #376: "StudentProfile" ile INNER JOIN KALDIRILDI. Takim atamasinda
    -- studentProfileId NULL oldugu icin o join TUM takim projelerini
    -- darbogaz analizinden eliyordu; panel sessizce eksik tablo gosteriyordu.
    -- Kapsam artik atama duzeyinde, profile baglanmadan.
    WHERE ${mentorunAtamasiSql(mentorUserId ?? null)}
    GROUP BY pt."title", st."order"
    ORDER BY "ortancaSaat" DESC NULLS LAST
    LIMIT 20
  `;

  return satirlar.map((s) => ({
    projeBasligi: s.projeBasligi,
    adimSirasi: s.adimSirasi,
    adimBasligi: s.adimBasligi,
    // BigInt JSON'a serileşmez; sınırda patlamasın diye burada çeviriyoruz.
    tamamlayanSayisi: Number(s.tamamlayanSayisi),
    ortalamaGun: saatiGune(s.ortalamaSaat),
    ortancaGun: saatiGune(s.ortancaSaat),
  }));
}

export type YanitSuresi = {
  mentorId: string;
  ad: string | null;
  soyad: string | null;
  email: string;
  yanitlananSoru: number;
  ortalamaSaat: number;
  ortancaSaat: number;
};

type YanitHam = {
  mentorId: string;
  ad: string | null;
  soyad: string | null;
  email: string;
  yanitlananSoru: bigint;
  ortalamaSaat: number | null;
  ortancaSaat: number | null;
};

/**
 * Mentör bir öğrenci mesajına ortalama kaç saatte dönüyor?
 *
 * "Yanıt" = öğrencinin mesajından SONRAKİ ilk mentör mesajı, aynı ikili içinde.
 * Öğrencinin arka arkaya attığı mesajlar tek bekleyiş sayılıyor: her birini ayrı
 * saymak, çok yazan öğrencinin mentörünü haksız yere kötü gösterirdi.
 *
 * ⚠️ BU BİR PERFORMANS ÖLÇÜMÜ. Mentör kendi sayısını görür; mentörleri
 * birbiriyle KARŞILAŞTIRAN bir sıralama YOK. Karşılaştırmalı liste yalnızca
 * admin'e dönüyor ve orada da ürün kararı olarak "sıralama" değil "liste"
 * biçiminde sunuluyor.
 *
 * Henüz yanıtlanmamış mesajlar hesaba GİRMEZ — bekleyen bir soru "sonsuz
 * yanıt süresi" değil, ayrı bir olgudur (riskli öğrenci listesinde görünür).
 */
export async function mentorYanitSuresi(mentorUserId?: string): Promise<YanitSuresi[]> {
  const satirlar = await prisma.$queryRaw<YanitHam[]>`
    WITH ikili AS (
      SELECT m.id,
             m."senderId",
             m."receiverId",
             m."createdAt",
             u."role" AS "gonderenRol",
             -- Aynı ikilideki bir önceki mesajın kimden geldiği: yalnızca
             -- öğrenci→mentör'den mentör→öğrenci'ye GEÇİŞ bir yanıttır.
             LAG(u."role") OVER (
               PARTITION BY LEAST(m."senderId", m."receiverId"),
                            GREATEST(m."senderId", m."receiverId")
               ORDER BY m."createdAt"
             ) AS "oncekiRol",
             LAG(m."createdAt") OVER (
               PARTITION BY LEAST(m."senderId", m."receiverId"),
                            GREATEST(m."senderId", m."receiverId")
               ORDER BY m."createdAt"
             ) AS "oncekiZaman"
      FROM "Message" m
      JOIN "User" u ON u.id = m."senderId"
    ),
    yanitlar AS (
      SELECT i."senderId" AS "mentorId",
             EXTRACT(EPOCH FROM (i."createdAt" - i."oncekiZaman")) / 3600 AS saat
      FROM ikili i
      WHERE i."gonderenRol" = 'MENTOR'
        AND i."oncekiRol" = 'STUDENT'
        AND i."oncekiZaman" IS NOT NULL
    )
    SELECT u.id                                                  AS "mentorId",
           u."name"                                              AS "ad",
           u."lastName"                                          AS "soyad",
           u."email"                                             AS "email",
           COUNT(*)                                              AS "yanitlananSoru",
           AVG(y.saat)                                           AS "ortalamaSaat",
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY y.saat)   AS "ortancaSaat"
    FROM yanitlar y
    JOIN "User" u ON u.id = y."mentorId"
    WHERE ${mentorUserId ?? null}::text IS NULL
       OR u.id = ${mentorUserId ?? null}::text
    GROUP BY u.id, u."name", u."lastName", u."email"
    ORDER BY "ortancaSaat" ASC NULLS LAST
  `;

  return satirlar.map((s) => ({
    mentorId: s.mentorId,
    ad: s.ad,
    soyad: s.soyad,
    email: s.email,
    yanitlananSoru: Number(s.yanitlananSoru),
    ortalamaSaat: yuvarla(s.ortalamaSaat ?? 0),
    ortancaSaat: yuvarla(s.ortancaSaat ?? 0),
  }));
}

export type RiskliOgrenci = {
  studentUserId: string;
  ad: string | null;
  soyad: string | null;
  email: string;
  /** Son hareketten (adım geçişi / mesaj) bu yana geçen gün. null = hiç hareket yok. */
  sessizGun: number | null;
  /** IN_PROGRESS'te TAKILMA_GUN'den uzun süredir bekleyen adım sayısı. */
  takilanAdim: number;
  /** Mentöre iletilmiş ama yanıtlanmamış mesaj var mı? */
  bekleyenSoru: boolean;
};

type RiskliHam = {
  studentUserId: string;
  ad: string | null;
  soyad: string | null;
  email: string;
  sonHareket: Date | null;
  takilanAdim: bigint;
  bekleyenSoru: boolean;
};

/**
 * Bırakma riski taşıyan öğrenciler.
 *
 * SKOR YOK, SİNYAL VAR. Dönen alanların hepsi doğrulanabilir olgular; mentör
 * kendi yargısını bunlara bakarak kurar. Sıralama "en uzun süredir sessiz"
 * ölçütüne göre — bu bir öncelik önerisidir, bir teşhis değil.
 *
 * Yalnızca AKTİF stajyerler (APPROVED) dahil: mezun ya da reddedilmiş bir
 * hesabın "sessiz" olması beklenen durumdur, listede gürültü yapar.
 */
export async function riskliOgrenciler(mentorUserId?: string): Promise<RiskliOgrenci[]> {
  const satirlar = await prisma.$queryRaw<RiskliHam[]>`
    WITH ogrenciler AS (
      SELECT u.id AS "userId", u."name", u."lastName", u."email", sp.id AS "profilId"
      FROM "User" u
      JOIN "StudentProfile" sp ON sp."userId" = u.id
      WHERE u."role" = 'STUDENT'
        AND u."accountStatus" = 'APPROVED'
        -- #376: Bireysel MentorAssignment VEYA TeamMentor bağı.
        AND ${mentorunOgrencisiSql(mentorUserId ?? null)}
    )
    SELECT o."userId"    AS "studentUserId",
           o."name"      AS "ad",
           o."lastName"  AS "soyad",
           o."email"     AS "email",
           GREATEST(
             COALESCE((
               SELECT MAX(h."createdAt") FROM "StepStatusHistory" h
               JOIN "RoadmapStep" st ON st.id = h."stepId"
               JOIN "Roadmap" rm     ON rm.id = st."roadmapId"
               JOIN "AssignedProject" ap ON ap.id = rm."assignedProjectId"
               WHERE ${atamaOgrencininSql("ap", Prisma.sql`o."profilId"`)}
             ), TIMESTAMP 'epoch'),
             COALESCE((
               SELECT MAX(m."createdAt") FROM "Message" m WHERE m."senderId" = o."userId"
             ), TIMESTAMP 'epoch')
           )                                                        AS "sonHareket",
           (
             SELECT COUNT(*) FROM "RoadmapStep" st2
             JOIN "Roadmap" rm2 ON rm2.id = st2."roadmapId"
             JOIN "AssignedProject" ap2 ON ap2.id = rm2."assignedProjectId"
             WHERE ${atamaOgrencininSql("ap2", Prisma.sql`o."profilId"`)}
               AND st2."status" = 'IN_PROGRESS'
               AND st2."updatedAt" < NOW() - (${TAKILMA_GUN} || ' days')::interval
           )                                                        AS "takilanAdim",
           EXISTS (
             SELECT 1 FROM "Message" m2
             WHERE m2."senderId" = o."userId" AND m2."isRead" = false
           )                                                        AS "bekleyenSoru"
    FROM ogrenciler o
    ORDER BY "sonHareket" ASC
    LIMIT 50
  `;

  const simdi = Date.now();

  return satirlar
    .map((s) => {
      // `TIMESTAMP 'epoch'` = hiç hareket yok. Gerçek bir tarih gibi
      // gösterilseydi "1970'ten beri sessiz" yazardı.
      const hicHareketYok = !s.sonHareket || s.sonHareket.getTime() <= 0;
      return {
        studentUserId: s.studentUserId,
        ad: s.ad,
        soyad: s.soyad,
        email: s.email,
        sessizGun: hicHareketYok
          ? null
          : Math.floor((simdi - s.sonHareket!.getTime()) / 86_400_000),
        takilanAdim: Number(s.takilanAdim),
        bekleyenSoru: s.bekleyenSoru,
      };
    })
    // Hiçbir sinyali olmayan öğrenciyi listeye almıyoruz: "risk listesi"nin
    // tamamı öğrenci olursa liste hiçbir şey söylemez.
    .filter(
      (o) =>
        o.sessizGun === null || o.sessizGun >= SESSIZLIK_GUN || o.takilanAdim > 0 || o.bekleyenSoru,
    );
}

function saatiGune(saat: number | null): number {
  return yuvarla((saat ?? 0) / 24);
}

function yuvarla(n: number): number {
  return Math.round(n * 10) / 10;
}
