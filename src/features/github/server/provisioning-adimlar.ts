import { atamaninAiRizasiVar } from "@/features/kvkk/riza";
import { prisma } from "@/lib/db";
import { generateStepIssues } from "@/features/ai/server/issue-generator";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";
import { hataMesaji, type GitHubConfig } from "./client";
import { type Atama, sahipTanimi, takimSeviyesi, repoAdi, milestoneNumarasiCikar } from "./provisioning-yardimcilar";
import { repoyuHazirla, milestoneHazirla, issueHazirla } from "./repo";

/**
 * GitHub kurulumunun adımları: repo, milestone ve issue oluşturma (gerçek API
 * veya simülasyon). Orkestrasyon ve kayıt provisioning.ts içinde kalır.
 */

/**
 * Kurulum zaten sürerken ikinci kez başlatılmaya çalışıldı.
 *
 * Ayrı bir tip: çağıran route bunu 500 (sunucu hatası) değil **409 Conflict**
 * olarak yanıtlamalı — istek geçerli, yalnızca şu an uygun bir durum değil.
 */
export class KurulumZatenSuruyorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KurulumZatenSuruyorError";
  }
}

/** Arka plana alınan kurulumun BAŞLATMA yanıtı (işin kendisi değil). */
export type KurulumBaslatmaSonucu = {
  started: true;
  /** #178-1: true ise GitHub'da fiziksel bir şey oluşturulmayacak. */
  simulated: boolean;
  guncelleme: boolean;
  message: string;
};

export type ProvisioningResult = {
  success: boolean;
  githubRepoUrl: string;
  createdMilestonesCount: number;
  createdIssuesCount: number;
  message: string;
  /** #178-1: true ise GitHub'da fiziksel bir şey oluşturulmadı. */
  simulated: boolean;
  /** İlk kurulum mu, mevcut çalışma alanının güncellenmesi mi. */
  guncelleme: boolean;
};


/**
 * Yol haritası adımları için AI issue içeriklerini üretir.
 *
 * Bu adım her iki yolda da (gerçek/simülasyon) çalışır — içerikler gerçektir
 * ve DB'de saklanır; yalnızca GitHub'a gönderilmeleri yapılandırmaya bağlıdır.
 *
 * #269: GitHub'a GÖNDERİLMİŞ adımda AI HİÇ çağrılmaz. Üç nedeni var:
 * - `storeGeneratedIssues` kayıtları siliyor; gönderilmiş issue bağlantıları
 *   kaybolurdu
 * - AI her seferinde farklı başlık üretebiliyor; `issueHazirla` eşleştirmeyi
 *   başlığa göre yaptığı için GitHub'da KOPYA issue açılırdı
 * - gereksiz AI maliyeti ve gecikme
 *
 * Yani güncelleme, var olan adımlara dokunmadan yalnızca eksikleri tamamlıyor.
 */
export async function issueIcerikleriniUret(atama: Atama): Promise<void> {
  /*
   * ⚠️ #389: KVKK AÇIK RIZASI OLMADAN GEMINI'YE GİTMEZ.
   *
   * Bu kontrol yoktu ve rızası olmayan öğrencinin adım metinleri sessizce
   * yurt dışındaki modele gönderiliyordu. Kurulumu ÖĞRENCİ tetiklemiyor
   * (mentör talep eder, admin onaylar — #349), yani rızasız öğrencinin
   * süreci durdurabileceği hiçbir nokta yoktu.
   *
   * ⚠️ RIZA YOKSA KURULUM ÇÖKMEZ. Depo, milestone ve adım issue'ları AI'sız
   * da açılabilmeli; `generateStepIssues` zaten mock içeriğe düşebiliyor.
   * Rızayı yokluğu yüzünden çalışma alanını hiç kurmamak, cezayı yanlış yere
   * keserdi.
   */
  const rizaVar = await atamaninAiRizasiVar(atama.id);
  if (!rizaVar) {
    logger.info("AI issue üretimi ATLANDI — açık rıza yok", { assignmentId: atama.id });
    incrementCounter("provisioning.issue-uretimi.riza-yok");
    return;
  }

  // PERFORMANS: adımlar PARALEL işleniyor.
  //
  // Öncesi seriydi ve her adım bir Gemini çağrısı olduğu için toplam süre adım
  // sayısıyla doğrusal büyüyordu (5 adımlık bir yol haritası tek başına
  // ~25 saniye). Adımlar birbirinden bağımsız: `generateStepIssues` yalnız
  // KENDİ adımının StepIssue kayıtlarını siliyor/yazıyor, bu yüzden paralel
  // çalışmaları çakışma üretmiyor.
  await Promise.all(
    atama.roadmap!.steps.map(async (step) => {
      const gonderilmisSayisi = await prisma.stepIssue.count({
        where: { stepId: step.id, githubIssueUrl: { not: null } },
      });

      if (gonderilmisSayisi > 0) return;

      await generateStepIssues({
        stepId: step.id,
        stepTitle: step.title,
        stepDescription: step.description,
        projectTitle: atama.projectTemplate.title,
        // #332: Takımda issue içerikleri EN DÜŞÜK deneyim seviyesine göre
        // üretiliyor: pano ortak, en yeni üyenin de takip edebilmesi gerek.
        experienceLevel: takimSeviyesi(atama),
      });
    }),
  );
}

/** #178-1 davranışı: URL'ler yalnızca türetilir, GitHub'a gidilmez. */
export async function simulasyonlaKur(atama: Atama) {
  const orgName = process.env.GITHUB_ORG || "Posinowa";
  const githubRepoUrl = `https://github.com/${orgName}/${repoAdi(atama)}`;

  let createdIssuesCount = 0;

  for (const step of atama.roadmap!.steps) {
    const stepIssueUrl = `${githubRepoUrl}/issues?q=is%3Aissue+milestone%3A%22${encodeURIComponent(step.title)}%22`;
    await prisma.roadmapStep.update({
      where: { id: step.id },
      data: { githubIssueUrl: stepIssueUrl },
    });

    const stepIssues = await prisma.stepIssue.findMany({ where: { stepId: step.id } });
    for (const [index, issue] of stepIssues.entries()) {
      await prisma.stepIssue.update({
        where: { id: issue.id },
        data: { githubIssueUrl: `${githubRepoUrl}/issues/${index + 1}` },
      });
      createdIssuesCount++;
    }
  }

  return {
    githubRepoUrl,
    createdMilestonesCount: atama.roadmap!.steps.length,
    createdIssuesCount,
  };
}

/**
 * Zaten kayıtlı bir repo varsa ADINI ondan alır.
 *
 * Neden: repo adı öğrenci adı ve proje başlığından türetiliyor. Bu türetme
 * değişirse (ör. Türkçe karakter çevirisi düzeltilirse) güncelleme, var olan
 * repoyu bulamayıp YENİSİNİ açardı — öğrencinin işi eski repoda öksüz kalırdı.
 *
 * Yalnızca kayıtlı URL yapılandırılan hesaba aitse yeniden kullanılır; başka
 * bir hesabın reposunu güncellemeye çalışmak yanlış olur.
 */
export function mevcutRepoAdi(atama: Atama, config: GitHubConfig): string | null {
  if (!atama.githubRepoUrl) return null;

  const eslesme = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(
    atama.githubRepoUrl,
  );
  if (!eslesme) return null;

  const [, sahip, ad] = eslesme;
  if (sahip.toLowerCase() !== config.owner.toLowerCase()) return null;

  return ad;
}

/**
 * Gerçek GitHub kurulumu.
 *
 * Sayaçlar YALNIZCA gerçekten oluşturulanları sayar; güncellemede "0 yeni"
 * demek anlamlı bir sonuçtur, her şeyin yeniden yaratıldığı izlenimi vermez.
 */
export async function gercektenKur(atama: Atama, config: GitHubConfig) {
  // Kayıtlı repo varsa onu koru; yoksa addan türet.
  const repoName = mevcutRepoAdi(atama, config) ?? repoAdi(atama);

  const repo = await repoyuHazirla(config, {
    repoName,
    description: `${atama.projectTemplate.title} — ${sahipTanimi(atama)} (AISigner)`,
  });
  if (!repo.ok) throw new Error(hataMesaji(repo.neden));

  const githubRepoUrl = repo.veri.htmlUrl;
  let createdMilestonesCount = 0;
  let createdIssuesCount = 0;

  for (const step of atama.roadmap!.steps) {
    const stepIssues = await prisma.stepIssue.findMany({ where: { stepId: step.id } });

    // #345: GÖNDERİLMİŞ KAYITLAR YENİDEN GÖNDERİLMEZ.
    //
    // Öncesi her çalıştırmada bütün issue'ları `issueHazirla`'ya veriyor ve
    // kopya oluşmasını onun BAŞLIK TARAMASINA bırakıyordu. O tarama
    // güvenilir değil: GitHub'ın liste uçları anında tutarlı DEĞİL, yeni
    // açılmış bir issue listede gecikmeli görünüyor. Canlı testte art arda
    // iki çağrı KOPYA issue açtı (#345).
    //
    // Artık otoriter kaynak veritabanı: `githubIssueUrl` doluysa o kayıt
    // GitHub'a gitmiş demektir ve dokunulmaz.
    const bekleyenIssuelar = stepIssues.filter((i) => !i.githubIssueUrl);

    // Adımın milestone'u kurulmuş VE tüm issue'ları gönderilmişse GitHub'a
    // hiç uğramıyoruz — güncelleme akışı yalnız eksikleri tamamlar.
    if (step.githubIssueUrl && bekleyenIssuelar.length === 0) continue;

    // Milestone da aynı mantıkla: kayıtlı URL varsa numarayı ondan okuyup
    // yeniden oluşturmuyoruz. `milestoneHazirla` de başlık taramasına
    // dayanıyor ve aynı kopya riskini taşıyor.
    let milestoneNumarasi = milestoneNumarasiCikar(step.githubIssueUrl);

    if (milestoneNumarasi === null) {
      const milestone = await milestoneHazirla(config, {
        repoName,
        title: step.title,
        description: step.description,
      });
      if (!milestone.ok) throw new Error(hataMesaji(milestone.neden));
      if (milestone.olusturuldu) createdMilestonesCount++;
      milestoneNumarasi = milestone.veri.number;

      await prisma.roadmapStep.update({
        where: { id: step.id },
        data: { githubIssueUrl: `${githubRepoUrl}/milestone/${milestoneNumarasi}` },
      });
    }

    for (const issue of bekleyenIssuelar) {
      const olusan = await issueHazirla(config, {
        repoName,
        title: issue.title,
        body: issue.bodyMarkdown,
        milestoneNumber: milestoneNumarasi,
      });
      if (!olusan.ok) throw new Error(hataMesaji(olusan.neden));
      if (olusan.olusturuldu) createdIssuesCount++;

      // URL HEMEN yazılıyor: araya bir hata girerse bir sonraki çalıştırma
      // bu issue'yu "gönderilmemiş" sayıp ikinci kez açardı.
      await prisma.stepIssue.update({
        where: { id: issue.id },
        data: { githubIssueUrl: olusan.veri.htmlUrl },
      });
    }
  }

  return { githubRepoUrl, createdMilestonesCount, createdIssuesCount };
}
