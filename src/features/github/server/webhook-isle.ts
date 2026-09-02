import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { adimDurumunuDegistir } from "@/features/roadmap/server/step-status";

/**
 * GitHub webhook olaylarının işlenmesi (#326).
 *
 * Kapsam bilinçli olarak DAR: yalnızca "issue kapandı" ve "PR merge edildi"
 * olayları adım durumunu ilerletiyor. Code review yorumlarının panele
 * senkronizasyonu ayrı bir veri modeli kararı gerektiriyor (GitHub kullanıcısı
 * ↔ platform kullanıcısı eşlemesi) — bu PR'a alınmadı, #326'da not düşüldü.
 */

export type IsleSonucu = {
  islendi: boolean;
  /** Teşhis için: ne yapıldı. */
  aciklama: string;
};

/** GitHub olay gövdesinden issue URL'ini çıkarır. */
function issueUrlAl(govde: unknown): string | null {
  const g = govde as {
    issue?: { html_url?: string };
    pull_request?: { html_url?: string };
  };
  return g?.issue?.html_url ?? g?.pull_request?.html_url ?? null;
}

/**
 * Bir GitHub issue/PR kapandığında ilgili adımı ilerletir.
 *
 * ADIM TAMAMLAMA KURALLARI BURADA FARKLI — bilinçli:
 * Öğrenci ucu "önce başlat" ve "önceki adımı bitir" kurallarını uygular; bunlar
 * öğrenciyi akışa dahil etmek için var. Webhook'ta GitHub *kanıt* sunuyor: iş
 * gerçekten yapıldı. Burada da aynı kuralları dayatmak, GitHub ile platformu
 * kalıcı olarak tutarsız bırakırdı — ki #326'nın çözmeye çalıştığı sorun tam
 * olarak bu.
 *
 * Durum geçişi `adimDurumunuDegistir` üzerinden yapılıyor ki geçmişe (#324)
 * yazılsın. `degistirenId: null` — işlemi bir platform kullanıcısı yapmadı.
 */
export async function issueKapandiginiIsle(
  govde: unknown,
  /**
   * #379: Kapanma MERGE EDİLMİŞ bir PR'dan mı geldi?
   *
   * Kaydediliyor çünkü revizyon istendiğinde GitHub davranışını bu belirliyor:
   * merge edilmiş iş için YENİ issue açılır (kod ana dalda; eskisini yeniden
   * açmak yapılmamış gibi gösterirdi), edilmemişse mevcut issue yeniden açılır.
   */
  mergeIleKapandi = false,
): Promise<IsleSonucu> {
  const url = issueUrlAl(govde);
  if (!url) return { islendi: false, aciklama: "olayda issue/PR url'i yok" };

  const stepIssue = await prisma.stepIssue.findFirst({
    where: { githubIssueUrl: url },
    select: { id: true, stepId: true, status: true },
  });

  // Bu repoda bizim açmadığımız issue'lar da olabilir; eşleşme yoksa sessizce
  // geç. Hata DEĞİL — GitHub'a 200 dönmeliyiz, yoksa webhook'u devre dışı bırakır.
  if (!stepIssue) return { islendi: false, aciklama: "eşleşen StepIssue yok" };

  if (stepIssue.status !== "CLOSED") {
    await prisma.stepIssue.update({
      where: { id: stepIssue.id },
      data: { status: "CLOSED", mergeIleKapandi },
    });
  }

  // Adımın TÜM issue'ları kapandıysa adım tamamlanmıştır.
  const acikKalan = await prisma.stepIssue.count({
    where: { stepId: stepIssue.stepId, status: { not: "CLOSED" } },
  });

  if (acikKalan > 0) {
    return { islendi: true, aciklama: `issue kapatıldı, adımda ${acikKalan} açık issue kaldı` };
  }

  const adim = await prisma.roadmapStep.findUnique({
    where: { id: stepIssue.stepId },
    select: { status: true },
  });

  if (!adim || adim.status === "COMPLETED") {
    return { islendi: true, aciklama: "adım zaten tamamlanmış" };
  }

  await adimDurumunuDegistir({
    stepId: stepIssue.stepId,
    yeniDurum: "COMPLETED",
    oncekiDurum: adim.status,
    degistirenId: null,
  });

  logger.info("Webhook adımı tamamladı", { stepId: stepIssue.stepId, url });
  return { islendi: true, aciklama: "adım COMPLETED yapıldı" };
}

/**
 * Bir GitHub issue/PR YENİDEN AÇILDIĞINDA adımı geri çeker (#378).
 *
 * NEDEN GEREKLİ: Webhook yalnız `closed` olayını dinliyordu. Yanlışlıkla
 * kapatılan bir issue geri açıldığında platform bundan habersiz kalıyor ve
 * adım veritabanında COMPLETED olarak duruyordu — kaynak (GitHub) ile ayna
 * (AISigner) sessizce ayrışıyordu. #326'nın çözmeye çalıştığı sorunun aynısı,
 * ters yönde.
 *
 * ⚠️ REVİZYON DURUMU EZİLMEZ. #379 revizyon istendiğinde issue'yu YENİDEN
 * AÇIYOR; GitHub o işlemin webhook'unu bize geri gönderiyor. Burada körlemesine
 * IN_PROGRESS yazsaydık mentörün az önce koyduğu REVISION_REQUESTED durumunu
 * kendi tetiklediğimiz olayla silerdik — gerekçe geçmişte kalır ama öğrenci
 * panosunda "revizyon istendi" rozeti kaybolurdu.
 */
export async function issueYenidenAcildiginiIsle(govde: unknown): Promise<IsleSonucu> {
  const url = issueUrlAl(govde);
  if (!url) return { islendi: false, aciklama: "olayda issue/PR url'i yok" };

  const stepIssue = await prisma.stepIssue.findFirst({
    where: { githubIssueUrl: url },
    select: { id: true, stepId: true, status: true },
  });
  if (!stepIssue) return { islendi: false, aciklama: "eşleşen StepIssue yok" };

  if (stepIssue.status !== "OPEN") {
    await prisma.stepIssue.update({
      where: { id: stepIssue.id },
      data: { status: "OPEN" },
    });
  }

  const adim = await prisma.roadmapStep.findUnique({
    where: { id: stepIssue.stepId },
    select: { status: true },
  });
  if (!adim) return { islendi: true, aciklama: "adım bulunamadı" };

  // Yalnızca TAMAMLANMIŞ adım geri çekilir. REVISION_REQUESTED'a dokunulmaz
  // (yukarıdaki uyarı), TODO/IN_PROGRESS zaten açık.
  if (adim.status !== "COMPLETED") {
    return { islendi: true, aciklama: `adım ${adim.status}, durum korundu` };
  }

  await adimDurumunuDegistir({
    stepId: stepIssue.stepId,
    yeniDurum: "IN_PROGRESS",
    oncekiDurum: adim.status,
    // İşlemi bir platform kullanıcısı yapmadı; GitHub'dan geldi.
    degistirenId: null,
  });

  logger.info("Webhook adımı geri çekti", { stepId: stepIssue.stepId, url });
  return { islendi: true, aciklama: "adım IN_PROGRESS yapıldı" };
}
