import "server-only";
import { Prisma } from "@prisma/client";

/**
 * Sahiplik kurallarının SQL karşılıkları (#376).
 *
 * ⚠️ NEDEN AYRI BİR DOSYA — VE NEDEN TEHLİKELİ:
 *
 * `sahiplik.ts` "bu öğrenci/proje kimin" sorusunun tek doğru kaynağı, ama
 * Prisma diliyle yazılmış. Analitik paneli (#331) ham SQL kullanıyor: üç
 * sorgu da toplama yapıyor ve satırları JS'e çekmek öğrenci sayısıyla
 * bağlantı havuzunu tıkardı (#313 dersi). Yani kural İKİ DİLDE var olmak
 * zorunda.
 *
 * Bu tam olarak #370'in kaçınmaya çalıştığı durum: aynı kuralın iki kopyası,
 * biri güncellenip diğeri unutulunca sessizce ayrışır. Kopyayı kaldıramıyoruz
 * ama **tek dosyaya** hapsedebiliriz — SQL tarafında kural yalnızca burada
 * yazılı. Yeni bir ham sorgu yazan buradan geçirmeli.
 *
 * ⚠️ Değişiklik yapan, `sahiplik.ts`'teki karşılığını da güncellemeli:
 *   mentorunOgrencisiWhere()  ↔  mentorunOgrencisiSql()
 *   mentorErisimiWhere()      ↔  mentorunAtamasiSql()
 *
 * ⚠️ AYRILMIŞ ÜYE (`leftAt IS NOT NULL`) hiçbirinde sayılmaz. Satır katkı
 * geçmişi için duruyor (#332), üyelik olarak değil.
 */

/**
 * Bu ATAMA bu mentörün kapsamında mı?
 *
 * `AssignedProject` takma adı `ap` olarak varsayılıyor.
 * `mentorUserId` null ise kapsam daraltılmaz (admin görünümü).
 */
export function mentorunAtamasiSql(mentorUserId: string | null) {
  return Prisma.sql`(
    ${mentorUserId}::text IS NULL
    OR EXISTS (
         SELECT 1 FROM "MentorAssignment" ma
         WHERE ma."studentProfileId" = ap."studentProfileId"
           AND ma."mentorId" = ${mentorUserId}::text
       )
    OR EXISTS (
         SELECT 1 FROM "TeamMentor" tm
         WHERE tm."teamId" = ap."teamId"
           AND tm."mentorId" = ${mentorUserId}::text
       )
  )`;
}

/**
 * Bu ÖĞRENCİ bu mentörün kapsamında mı?
 *
 * `StudentProfile` takma adı `sp` olarak varsayılıyor.
 */
export function mentorunOgrencisiSql(mentorUserId: string | null) {
  return Prisma.sql`(
    ${mentorUserId}::text IS NULL
    OR ${ogrenciMentoreBagliSql(Prisma.sql`${mentorUserId}::text`)}
  )`;
}

/**
 * "Bu öğrenci şu mentöre bağlı mı" — bağın KENDİSİ.
 *
 * `mentorunOgrencisiSql` bunu tek bir mentör kimliğiyle kullanıyor; mentör
 * BAŞINA sayan sorgular ise sütun ifadesiyle (ör. `m.id`) çağırıyor.
 *
 * ⚠️ Bağ İKİ YOLDAN kurulur: bireysel `MentorAssignment` VEYA takım
 * üzerinden `TeamMentor` (#332). Yalnız ilkine bakan bir sorgu, takımı olup
 * bireysel bağı olmayan stajyerleri sessizce düşürür — bu hata sınıfı bu
 * kod tabanında dört kez yaşandı (#367/#370/#376/#393).
 *
 * `StudentProfile` takma adı `sp` olarak varsayılıyor.
 */
export function ogrenciMentoreBagliSql(mentorIfadesi: Prisma.Sql) {
  return Prisma.sql`(
    EXISTS (
      SELECT 1 FROM "MentorAssignment" ma
      WHERE ma."studentProfileId" = sp.id
        AND ma."mentorId" = ${mentorIfadesi}
    )
    OR EXISTS (
      SELECT 1 FROM "TeamMember" tmb
      JOIN "TeamMentor" tm ON tm."teamId" = tmb."teamId"
      WHERE tmb."studentProfileId" = sp.id
        AND tmb."leftAt" IS NULL
        AND tm."mentorId" = ${mentorIfadesi}
    )
  )`;
}

/**
 * Bu ATAMA bu öğrenci profiline ait mi? (bireysel VEYA takım üyeliği)
 *
 * ⚠️ #332'nin can alıcı noktası: takım atamasında `studentProfileId` **NULL**.
 * Yalnız eşitliğe bakan bir koşul takım projelerini komple eler — ve bu HATA
 * OLARAK GÖRÜNMEZ, sadece sayılar düşük çıkar.
 *
 * @param atamaTakmaAdi sorgudaki `AssignedProject` takma adı
 * @param profilSutunu  karşılaştırılacak profil kimliği ifadesi
 */
export function atamaOgrencininSql(atamaTakmaAdi: string, profilSutunu: Prisma.Sql) {
  const ap = Prisma.raw(`"${atamaTakmaAdi}"`);
  return Prisma.sql`(
    ${ap}."studentProfileId" = ${profilSutunu}
    OR EXISTS (
         SELECT 1 FROM "TeamMember" tmb
         WHERE tmb."teamId" = ${ap}."teamId"
           AND tmb."studentProfileId" = ${profilSutunu}
           AND tmb."leftAt" IS NULL
       )
  )`;
}
