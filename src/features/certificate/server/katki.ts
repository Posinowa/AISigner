import { prisma } from "@/lib/db";

/**
 * Sertifikanın kapsamı: öğrencinin projeleri ve mentörleri (#449).
 *
 * ⚠️ NEDEN AYRI MODÜL: `getStudentCertificate` (öğrencinin kendi görünümü) ve
 * `verifyCertificate` (public doğrulama) AYNI belgeyi iki kez derliyordu.
 * Kural iki yerde yazılıysa biri güncellenip diğeri unutulur — bu kod
 * tabanında altı kez yaşanmış hata sınıfı (#367/#370/#376/#393/#442/#449).
 * İkisinin AYNI belgeyi göstermemesi ayrıca doğrulamanın anlamını yok ederdi.
 *
 * ⚠️ #449'UN KENDİSİ BU KÖRLÜĞÜN ALTINCI ÖRNEĞİYDİ: iki fonksiyon da yalnız
 * `assignedProjects` ve `mentorAssignments` okuyordu. Takım atamasında
 * `studentProfileId` NULL (#332) ve takım mentörü `TeamMentor`'da — yani tüm
 * işini takımda yapmış bir mezunun belgesi "geçerlidir" deyip HİÇBİR iş
 * göstermiyordu.
 */

/** Sertifikada gösterilecek proje. */
export type SertifikaProjesi = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  track: string[];
  /**
   * ⚠️ TAKIMDA BU SAYI ÖĞRENCİNİN KENDİ KATKISIDIR, takımın toplamı değil.
   * Bireysel projede ikisi aynı şey.
   */
  completedStepsCount: number;
  /** Projenin toplam adım sayısı (takımda takımın kapsamı). */
  totalStepsCount: number;
  /** Doluysa satır bir TAKIM projesidir; bireysel projede null. */
  takimAdi: string | null;
};

export type SertifikaMentoru = {
  id: string;
  name: string | null;
  lastName: string | null;
  /** Yalnız `epostaDahil` istendiğinde dolu — public yüzeyde PII çekilmez. */
  email: string | null;
};

export type SertifikaKapsami = {
  projeler: SertifikaProjesi[];
  mentorler: SertifikaMentoru[];
};

/**
 * Bu adım öğrencinin katkısı mı?
 *
 * ⚠️ İKİ SİNYAL BİRDEN (#332'de yazılı kural): `assigneeId` "kim üstlendi",
 * `StepStatusHistory.changedById` "kim tamamladı" (#324). Yalnız üstlenmeye
 * bakmak, üstlenmeden bitirilen işi kaybederdi; yalnız tamamlamaya bakmak,
 * geçmiş kaydı o gün tutulmaya başlamadan önceki işi kaybederdi.
 *
 * ⚠️ Bilinen bedel: bir öğrenci başkasının işini "tamamlandı" işaretlerse o
 * adım ona da sayılır. Panonun sözleşmesi işi yapanın kapatması; ters ihtimal
 * için katkıyı SIFIRA yakın tutmak, gerçekten çalışmış stajyerin belgesini
 * boşaltmaktan daha kötü bir hata olurdu.
 */
type KatkiAdimi = {
  status: string;
  assigneeId: string | null;
  /** Bu kullanıcının yazdığı COMPLETED geçişleri (sorguda süzülmüş). */
  history: { id: string }[];
};

export function ogrencininKatkisi(adimlar: KatkiAdimi[], userId: string): number {
  return adimlar.filter(
    (a) =>
      a.status === "COMPLETED" && (a.assigneeId === userId || a.history.length > 0),
  ).length;
}

/**
 * Sertifika için atama koşulu.
 *
 * ⚠️ `sahiplik.ts`'teki `ogrencininAtamalariWhere` BİLEREK KULLANILMADI ve bu
 * bir istisna olarak burada yazılı. O fonksiyon "bu atama ŞU AN kimin"
 * sorusunu yanıtlıyor ve ayrılmış üyeyi `leftAt: null` ile eliyor — bir YETKİ
 * sorusu için doğru. Sertifika ise "bu kişi NE YAPTI" sorusu ve CLAUDE.md
 * #332 tam bu yüzden şöyle diyor:
 *
 *   "Ayrılmış üye sahip DEĞİL ama satırı SİLİNMİYOR (`leftAt`) — katkı
 *    geçmişi SERTİFİKANIN DAYANAĞI."
 *
 * Yani `leftAt` alanının var olma sebebi tam da bu ekran. Yetki kuralını
 * buraya uygulasaydık, şemanın korumak için tasarlandığı durumu düşürürdük:
 * takımda üç ay çalışıp ayrılan stajyerin emeği belgesinde hiç görünmezdi.
 *
 * Ayrılmış üyenin projesi yine de KOŞULSUZ listelenmiyor — katkısı sıfırsa
 * eleniyor (aşağıya bakın); böylece "katıldı, hiç iş yapmadan ayrıldı"
 * durumu belgede proje gibi durmuyor.
 */
function sertifikaAtamalariWhere(studentProfileId: string) {
  return {
    OR: [
      { studentProfileId },
      // leftAt SÜZÜLMEZ — gerekçe yukarıda.
      { team: { members: { some: { studentProfileId } } } },
    ],
  };
}

/**
 * Öğrencinin sertifikaya girecek projelerini ve mentörlerini derler.
 *
 * @param epostaDahil Mentör e-postası çekilsin mi. Public doğrulama sayfası
 *   için `false`: #208'de PII'nin sorguya HİÇ girmemesi kararlaştırılmıştı
 *   (yanıttan ayıklamak değil, baştan çekmemek).
 */
export async function sertifikaKapsaminiGetir(
  studentProfileId: string,
  userId: string,
  { epostaDahil }: { epostaDahil: boolean },
): Promise<SertifikaKapsami> {
  const [atamalar, bireyselMentorler, takimMentorleri] = await Promise.all([
    prisma.assignedProject.findMany({
      where: sertifikaAtamalariWhere(studentProfileId),
      include: {
        projectTemplate: true,
        team: { select: { name: true } },
        roadmap: {
          include: {
            steps: {
              select: {
                id: true,
                status: true,
                assigneeId: true,
                // Yalnız BU kullanıcının COMPLETED geçişleri — tüm geçmişi
                // çekip JS'te süzmek gereksiz satır taşırdı (#452 dersi).
                history: {
                  where: { toStatus: "COMPLETED", changedById: userId },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mentorAssignment.findMany({
      where: { studentProfileId },
      select: {
        mentor: {
          select: { id: true, name: true, lastName: true, email: epostaDahil },
        },
      },
    }),
    // #449: Takım mentörü `MentorAssignment`'ta DEĞİL — bu yüzden görünmüyordu.
    prisma.teamMentor.findMany({
      where: { team: { members: { some: { studentProfileId } } } },
      select: {
        mentor: {
          select: { id: true, name: true, lastName: true, email: epostaDahil },
        },
      },
    }),
  ]);

  const projeler: SertifikaProjesi[] = [];
  for (const p of atamalar) {
    const adimlar = p.roadmap?.steps ?? [];
    const takimProjesi = Boolean(p.teamId);

    const completedStepsCount = takimProjesi
      ? ogrencininKatkisi(adimlar, userId)
      : adimlar.filter((a) => a.status === "COMPLETED").length;

    // ⚠️ Katkısı olmayan TAKIM projesi listelenmez: aksi halde belge, öğrencinin
    // hiç dokunmadığı bir işi kendi projesi gibi gösterirdi. Bireysel projede
    // böyle bir eleme YOK — proje zaten ona atanmış, "başlamamış" da bir durum.
    if (takimProjesi && completedStepsCount === 0) continue;

    projeler.push({
      id: p.id,
      title: p.projectTemplate.title,
      description: p.projectTemplate.description,
      difficulty: p.projectTemplate.difficulty,
      track: p.projectTemplate.track,
      completedStepsCount,
      totalStepsCount: adimlar.length,
      takimAdi: takimProjesi ? (p.team?.name ?? "Takım") : null,
    });
  }

  // Aynı mentör hem bireysel hem takım üzerinden bağlı olabilir — tekilleştir.
  const mentorler = [
    ...new Map(
      [...bireyselMentorler, ...takimMentorleri].map((m) => [
        m.mentor.id,
        {
          id: m.mentor.id,
          name: m.mentor.name,
          lastName: m.mentor.lastName,
          email: (m.mentor as { email?: string }).email ?? null,
        },
      ]),
    ).values(),
  ];

  return { projeler, mentorler };
}
