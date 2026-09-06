import "server-only";
import { topluBildirimGonder } from "@/features/bildirim/server/bildirim";
import { BILDIRIM_TURLERI } from "@/features/bildirim/turler";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { adimDurumunuDegistir } from "./step-status";
import { mentorunOgrencisiWhere } from "@/features/teams/server/sahiplik";

/**
 * Mentör adım onay kapısı — revizyon isteği (#379).
 *
 * NEDEN VAR: Öğrenci bir adımı COMPLETED yaptığında kimse geri çekemiyordu.
 * Öğrenci ucu "tamamlanan adımın durumu değiştirilemez" diyor, mentör ucu ise
 * `status` alanını güvenlik gerekçesiyle hiç kabul etmiyordu. Bir staj
 * platformunda mentör onayı akışın merkezinde olmalı; öğrencinin "tamamladım"
 * demesi tek ve nihai söz olamaz.
 *
 * ⚠️ YETKİ MENTÖRE TAM AÇILMIYOR. Mentör adımı keyfî durumlara sürükleyemez;
 * yalnızca `COMPLETED → REVISION_REQUESTED` geçişi açık. `delete safeData.status`
 * kapısı bu yüzden kaldırılmadı, DARALTILDI.
 */

export const REVIZYON_DURUMU = "REVISION_REQUESTED";

export type RevizyonHatasi =
  | "adim-yok"
  | "yetki-yok"
  | "tamamlanmamis"
  | "gerekce-gerekli"
  | "mezun";

export type RevizyonSonucu =
  | { ok: true; stepId: string; issueUrl: string | null; repoUrl: string | null; mergeEdilmis: boolean }
  | { ok: false; neden: RevizyonHatasi };

/**
 * Adımı revizyona döndürür.
 *
 * Sıra kasıtlı: önce yetki (var olmayan/başkasının adımının durumu bile
 * sızmasın), sonra ön koşullar, en sonda yazma.
 */
export async function revizyonIste(params: {
  stepId: string;
  isteyenUserId: string;
  isteyenRol: string;
  gerekce: string;
}): Promise<RevizyonSonucu> {
  const gerekce = params.gerekce?.trim();

  const adim = await prisma.roadmapStep.findUnique({
    where: { id: params.stepId },
    select: {
      id: true,
      status: true,
      githubIssueUrl: true,
      roadmap: {
        select: {
          assignedProject: {
            select: {
              id: true,
              status: true,
              githubRepoUrl: true,
              studentProfile: {
                select: { userId: true, user: { select: { accountStatus: true } } },
              },
              team: {
                select: {
                  members: {
                    where: { leftAt: null },
                    select: {
                      studentProfile: {
                        select: { userId: true, user: { select: { accountStatus: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!adim) return { ok: false, neden: "adim-yok" };

  // ADMIN her adıma erişir; mentör yalnızca kendi öğrencisininkine (#370).
  if (params.isteyenRol !== "ADMIN") {
    const benim = await prisma.roadmapStep.findFirst({
      where: {
        id: params.stepId,
        roadmap: {
          assignedProject: {
            OR: [
              { studentProfile: mentorunOgrencisiWhere(params.isteyenUserId) },
              { team: { mentors: { some: { mentorId: params.isteyenUserId } } } },
            ],
          },
        },
      },
      select: { id: true },
    });
    if (!benim) return { ok: false, neden: "yetki-yok" };
  }

  // Yalnızca TAMAMLANMIŞ adım revize edilebilir: revizyon, biten bir işe
  // "eksik" demektir. Başlamamış adım için söylenecek şey yorumdur.
  if (adim.status !== "COMPLETED") return { ok: false, neden: "tamamlanmamis" };

  // #366 deseni: gerekçesiz revizyon öğrenciye aynı işi tekrar yaptırır.
  if (!gerekce) return { ok: false, neden: "gerekce-gerekli" };

  // #208: Mezunun portfolyosu salt-okunur; revizyon yazma işlemidir.
  const atama = adim.roadmap.assignedProject;
  const durumlar = atama.team
    ? atama.team.members.map((m) => m.studentProfile.user.accountStatus)
    : atama.studentProfile
      ? [atama.studentProfile.user.accountStatus]
      : [];
  if (durumlar.length > 0 && durumlar.every((d) => d === "GRADUATED")) {
    return { ok: false, neden: "mezun" };
  }

  await adimDurumunuDegistir({
    stepId: adim.id,
    yeniDurum: REVIZYON_DURUMU,
    oncekiDurum: adim.status,
    degistirenId: params.isteyenUserId,
    not: gerekce,
  });

  /*
   * Proje "tamamlandı" olarak kalmamalı.
   *
   * Öğrenci ucu bu yeniden hesabı yalnız COMPLETED'a geçerken yapıyor; buradan
   * gelen geçiş orayı hiç çalıştırmıyordu. Sonucu görünür bir tutarsızlık
   * olurdu: bir adımı revizyonda olan proje panoda "tamamlandı" görünürdü.
   */
  if (adim.roadmap.assignedProject.status === "COMPLETED") {
    await prisma.assignedProject.update({
      where: { id: adim.roadmap.assignedProject.id },
      data: { status: "IN_PROGRESS" },
    });
  }

  /*
   * #380: Öğrenci(ler)e bildir — YALNIZ uygulama içi.
   *
   * E-postaya bağlanmadı: revizyon, aktif çalışan bir stajyere gidiyor;
   * panele zaten giriyor. E-posta listesi bilinçli olarak "kullanıcı sonucu
   * öğrenmek için giriş yapamayabilir" olaylarıyla sınırlı.
   */
  const hedefler = atama.team
    ? atama.team.members.map((m) => m.studentProfile.userId)
    : atama.studentProfile
      ? [atama.studentProfile.userId]
      : [];

  await topluBildirimGonder(
    hedefler.map((userId) => ({
      userId,
      tur: BILDIRIM_TURLERI.ADIM_REVIZYON,
      baslik: "Mentörünüz revizyon istedi",
      govde: gerekce,
      link: "/student-dashboard",
    })),
  );

  logger.info("Adım revizyona döndürüldü", { stepId: adim.id });

  return {
    ok: true,
    stepId: adim.id,
    issueUrl: adim.githubIssueUrl,
    repoUrl: atama.githubRepoUrl,
    // GitHub tarafındaki karar çağırana bırakılıyor: bu modül veritabanı
    // durumundan sorumlu, ağ çağrısından değil.
    mergeEdilmis: false,
  };
}

/**
 * Adımın YÜRÜRLÜKTEKİ revizyon gerekçesi.
 *
 * Geçmişten okunuyor (#324): gerekçe geçişe ait, adıma değil. Bir adım birden
 * çok kez revize edilebilir ve her seferin kendi gerekçesi vardır; öğrenciye
 * gösterilecek olan SONUNCUSU.
 */
export async function guncelRevizyonGerekcesi(stepId: string): Promise<string | null> {
  const kayit = await prisma.stepStatusHistory.findFirst({
    where: { stepId, toStatus: REVIZYON_DURUMU },
    orderBy: { createdAt: "desc" },
    select: { note: true },
  });
  return kayit?.note ?? null;
}

/**
 * Birden çok adımın yürürlükteki revizyon gerekçesi — TEK sorgu.
 *
 * Adım başına ayrı sorgu atmak, yol haritası uzadıkça N+1 üretirdi (#313
 * dersi). `DISTINCT ON` ile her adımın EN SON revizyon kaydı alınıyor.
 */
export async function revizyonGerekceleri(stepIds: string[]): Promise<Map<string, string>> {
  const sonuc = new Map<string, string>();
  if (stepIds.length === 0) return sonuc;

  const satirlar = await prisma.$queryRaw<Array<{ stepId: string; note: string | null }>>`
    SELECT DISTINCT ON (h."stepId") h."stepId", h."note"
    FROM "StepStatusHistory" h
    WHERE h."stepId" = ANY(${stepIds}::text[])
      AND h."toStatus" = ${REVIZYON_DURUMU}
    ORDER BY h."stepId", h."createdAt" DESC
  `;

  for (const s of satirlar) if (s.note) sonuc.set(s.stepId, s.note);
  return sonuc;
}
