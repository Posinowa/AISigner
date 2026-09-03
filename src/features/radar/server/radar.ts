import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { topluBildirimGonder } from "@/features/bildirim/server/bildirim";
import { BILDIRIM_TURLERI } from "@/features/bildirim/turler";

/**
 * Takılma radarı (#397).
 *
 * Stajyerler çekindikleri için bir adımda günlerce takılıp kalıyor ve kimse
 * fark etmiyor. Radar bunu erken yakalayıp mentöre haber veriyor.
 *
 * ⚠️ SKOR YOK, SİNYAL VAR — #331'deki kararın aynısı. "Takılma riski %73"
 * bir insan hakkında uydurma kesinlik olurdu. Mentöre gösterilen şey doğrudan
 * verinin kendisi: "3 gündür bu adımda, GitHub'da da hareket yok".
 */

/** Adımın "takılmış" sayılması için geçmesi gereken gün. */
export const TAKILMA_GUN = 2;

export type TakilanAdim = {
  stepId: string;
  stepBaslik: string;
  ogrenciler: { userId: string; email: string; ad: string; bildirimAcik: boolean }[];
  gecenGun: number;
  /**
   * ⚠️ GitHub verisi VAR MI — "commit yok" ile "veri yok" karışmasın.
   *
   * BAGLA depolarında webhook hiç çalışmıyor (#366); çalışma alanı kurulmamış
   * atamalarda da sinyal gelmez. Bu bayrak `false` ise mentöre "bu öğrencide
   * GitHub verisi yok" diye AÇIKÇA söyleniyor.
   */
  githubVerisiVar: boolean;
  mentorIdler: string[];
};

const GUN_MS = 86_400_000;

/**
 * Takılmış adımları bulur.
 *
 * Ölçüt İKİ KATMANLI (sahibin kararı):
 *   1. Platform içi hareketsizlik — adım `IN_PROGRESS` ve N gündür
 *      dokunulmamış (temel; her stajyerde çalışır)
 *   2. GitHub commit'i — varsa hesaba katılır, YOKSA işaretlenir
 *
 * ⚠️ Mezun (`GRADUATED`) stajyer kapsam dışı: portfolyosu salt-okunur (#208),
 * "takıldı" demek anlamsız.
 */
export async function takilanAdimlariBul(): Promise<TakilanAdim[]> {
  const sinir = new Date(Date.now() - TAKILMA_GUN * GUN_MS);

  const adimlar = await prisma.roadmapStep.findMany({
    where: {
      status: "IN_PROGRESS",
      updatedAt: { lt: sinir },
      roadmap: { status: "PUBLISHED" },
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      roadmap: {
        select: {
          assignedProject: {
            select: {
              sonCommitAt: true,
              githubRepoUrl: true,
              studentProfile: {
                select: {
                  takilmaBildirimi: true,
                  user: { select: { id: true, email: true, name: true, lastName: true, accountStatus: true } },
                  mentorAssignments: { select: { mentorId: true } },
                },
              },
              team: {
                select: {
                  members: {
                    where: { leftAt: null },
                    select: {
                      studentProfile: {
                        select: {
                          takilmaBildirimi: true,
                          user: { select: { id: true, email: true, name: true, lastName: true, accountStatus: true } },
                        },
                      },
                    },
                  },
                  mentors: { select: { mentorId: true } },
                },
              },
            },
          },
        },
      },
    },
    take: 200,
  });

  const sonuc: TakilanAdim[] = [];

  for (const adim of adimlar) {
    const atama = adim.roadmap.assignedProject;

    /*
     * GitHub'da çalışıyorsa takılmış SAYILMAZ.
     *
     * `sonCommitAt` NULL ise karar veremiyoruz — o durumda platform sinyaliyle
     * devam ediyoruz ama bunu işaretliyoruz.
     */
    const githubVerisiVar = atama.sonCommitAt !== null;
    if (atama.sonCommitAt && atama.sonCommitAt >= sinir) continue;

    // #332: Takımda tüm aktif üyeler, bireyselde tek kişi.
    const profiller = atama.team
      ? atama.team.members.map((m) => m.studentProfile)
      : atama.studentProfile
        ? [atama.studentProfile]
        : [];

    const ogrenciler = profiller
      .filter((p) => p.user.accountStatus === "APPROVED")
      .map((p) => ({
        userId: p.user.id,
        email: p.user.email,
        ad: [p.user.name, p.user.lastName].filter(Boolean).join(" ") || "Stajyer",
        bildirimAcik: p.takilmaBildirimi,
      }));

    if (ogrenciler.length === 0) continue;

    const mentorIdler = atama.team
      ? atama.team.mentors.map((m) => m.mentorId)
      : (atama.studentProfile?.mentorAssignments ?? []).map((m) => m.mentorId);

    if (mentorIdler.length === 0) continue;

    sonuc.push({
      stepId: adim.id,
      stepBaslik: adim.title,
      ogrenciler,
      gecenGun: Math.floor((Date.now() - adim.updatedAt.getTime()) / GUN_MS),
      githubVerisiVar,
      mentorIdler,
    });
  }

  return sonuc;
}

/**
 * Bulunan takılmalar için bildirim gönderir.
 *
 * ⚠️ ADIM BAŞINA BİR KEZ. Radar her taramada aynı takılmayı görür; kullanıcıya
 * bir kez söylenmeli. Tekrar koruması `Notification.refId` üzerinden
 * veritabanında — "önce sorgula sonra yaz" değil, kaydın kendisi kanıt
 * (#345/#349 dersi).
 */
export async function takilmalariBildir(takilanlar: TakilanAdim[]): Promise<number> {
  let gonderilen = 0;

  for (const t of takilanlar) {
    const hedefler = [...t.mentorIdler, ...t.ogrenciler.map((o) => o.userId)];

    // Bu adım için DAHA ÖNCE bildirilenler.
    const oncekiler = await prisma.notification.findMany({
      where: {
        userId: { in: hedefler },
        type: BILDIRIM_TURLERI.ADIM_TAKILDI,
        refId: t.stepId,
      },
      select: { userId: true },
    });
    const bildirilmis = new Set(oncekiler.map((o) => o.userId));

    const adlar = t.ogrenciler.map((o) => o.ad).join(", ");
    const githubNotu = t.githubVerisiVar
      ? ""
      : " (bu projede GitHub verisi yok — yalnızca platform hareketi değerlendirildi)";

    const girdiler = [
      // Mentörler — opt-in'den BAĞIMSIZ.
      ...t.mentorIdler
        .filter((id) => !bildirilmis.has(id))
        .map((userId) => ({
          userId,
          tur: BILDIRIM_TURLERI.ADIM_TAKILDI,
          baslik: "Bir stajyeriniz adımda takılmış olabilir",
          govde:
            `${adlar}, "${t.stepBaslik}" adımında ${t.gecenGun} gündür ilerlemiyor.` +
            `${githubNotu} Kısa bir check-in iyi gelebilir.`,
          link: "/mentor-dashboard",
          refId: t.stepId,
        })),

      // Öğrenciler — YALNIZCA ayarı açık olanlar.
      ...t.ogrenciler
        .filter((o) => o.bildirimAcik && !bildirilmis.has(o.userId))
        .map((o) => ({
          userId: o.userId,
          tur: BILDIRIM_TURLERI.ADIM_TAKILDI,
          baslik: "Takıldıysan yardım isteyebilirsin",
          govde:
            `"${t.stepBaslik}" adımında ${t.gecenGun} gündür duruyorsun. ` +
            `Seni zorlayan bir hata varsa Posilog'a sorabilirsin.`,
          link: "/student-dashboard",
          refId: t.stepId,
        })),
    ];

    if (girdiler.length === 0) continue;
    await topluBildirimGonder(girdiler);
    gonderilen += girdiler.length;
  }

  return gonderilen;
}

/** Tarama + bildirim. Hata YUTULUR: radar, tetiklendiği akışı bozmamalı. */
export async function radarTaramasi(): Promise<number> {
  try {
    const takilanlar = await takilanAdimlariBul();
    if (takilanlar.length === 0) return 0;

    const sayi = await takilmalariBildir(takilanlar);
    if (sayi > 0) logger.info("Takılma radarı bildirim gönderdi", { sayi });
    return sayi;
  } catch (error) {
    logger.warn("Takılma radarı taraması başarısız", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
