import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { readGitHubConfig, getOctokit, hataNedeni } from "./client";
import { issueHazirla } from "./repo";
import { yenidenDene } from "./retry";
import { DIS_DEPO_DURUMU } from "@/features/proposals/server/oneri";

/**
 * Revizyon isteğinin GitHub'a yansıtılması (#379).
 *
 * ⚠️ KURAL: MERGE EDİLDİYSE YENİ ISSUE, EDİLMEDİYSE YENİDEN AÇ.
 *
 * Merge edilmiş bir işin issue'sunu yeniden açmak, ana dalda DURAN kodu
 * "yapılmamış" gibi gösterirdi. O iş gerçekten bitti; revizyon yeni bir iş,
 * dolayısıyla yeni bir issue hak ediyor. Merge edilmemişse iş zaten
 * tamamlanmamış — mevcut issue yeniden açılır.
 *
 * ⚠️ BAĞLI DEPOLARDA (BAGLA/LINKED) HİÇBİRİ ÇALIŞMAZ. Depo stajyerin
 * hesabında, GITHUB_TOKEN orada yetkisiz (#366). Bu durum SESSİZCE atlanıyor:
 * kullanıcı bedeli seçim anında zaten okumuştu, revizyon akışını hata
 * göstererek bozmanın anlamı yok.
 *
 * ⚠️ HATA REVİZYONU GERİ ALMAZ. Platform durumu tek doğru kaynak; GitHub
 * senkronu başarısız olursa loglanır ve akış sürer. Tersi olsaydı GitHub
 * erişilemezken mentör revizyon isteyemezdi.
 */

export type SenkSonucu = {
  yeniIssueUrl?: string;
  yenidenAcilan: number;
  atlandi?: "yapilandirma-yok" | "dis-depo" | "repo-yok" | "issue-yok";
};

/** URL'den `sahip/depo` ve issue numarasını çıkarır. */
function issueAyristir(url: string): { repo: string; number: number } | null {
  const m = /github\.com\/[^/]+\/([^/]+)\/issues\/(\d+)/.exec(url);
  return m ? { repo: m[1], number: Number(m[2]) } : null;
}

export async function revizyonuGitHubaYansit(params: {
  stepId: string;
  gerekce: string;
}): Promise<SenkSonucu> {
  const config = readGitHubConfig();
  if (!config) return { yenidenAcilan: 0, atlandi: "yapilandirma-yok" };

  const adim = await prisma.roadmapStep.findUnique({
    where: { id: params.stepId },
    select: {
      title: true,
      roadmap: {
        select: {
          assignedProject: { select: { githubRepoUrl: true, githubStatus: true } },
        },
      },
    },
  });

  const atama = adim?.roadmap.assignedProject;
  if (!atama?.githubRepoUrl) return { yenidenAcilan: 0, atlandi: "repo-yok" };

  // Dış depoya (stajyerin kendi hesabı) yazma yetkimiz yok.
  if (atama.githubStatus === DIS_DEPO_DURUMU) {
    return { yenidenAcilan: 0, atlandi: "dis-depo" };
  }

  const issuelar = await prisma.stepIssue.findMany({
    where: { stepId: params.stepId, githubIssueUrl: { not: null } },
    select: { id: true, githubIssueUrl: true, title: true, mergeIleKapandi: true },
  });
  if (issuelar.length === 0) return { yenidenAcilan: 0, atlandi: "issue-yok" };

  const octokit = getOctokit(config);
  const mergeEdilmisVar = issuelar.some((i) => i.mergeIleKapandi);

  // --- Merge edilmiş iş: YENİ issue
  if (mergeEdilmisVar) {
    const repoAdi = issueAyristir(issuelar[0].githubIssueUrl!)?.repo;
    if (!repoAdi) return { yenidenAcilan: 0, atlandi: "issue-yok" };

    const sonuc = await issueHazirla(config, {
      repoName: repoAdi,
      // Başlığa zaman damgası: aynı adım birden çok kez revize edilebilir ve
      // `issueHazirla` başlığa göre kopya elemesi yapıyor (#345).
      title: `[Revizyon] ${adim!.title} — ${new Date().toISOString().slice(0, 16)}`,
      body:
        `Mentör bu adım için revizyon istedi.\n\n` +
        `**Gerekçe:**\n\n${params.gerekce}\n\n` +
        `_Önceki iş merge edildiği için eski issue yeniden açılmadı; bu revizyon yeni bir iştir._`,
    });

    if (!sonuc.ok) {
      logger.warn("Revizyon issue'su açılamadı", { stepId: params.stepId, neden: sonuc.neden });
      return { yenidenAcilan: 0 };
    }
    return { yeniIssueUrl: sonuc.veri.htmlUrl, yenidenAcilan: 0 };
  }

  // --- Merge edilmemiş iş: mevcut issue'ları YENİDEN AÇ
  let acilan = 0;
  for (const kayit of issuelar) {
    const ayrik = issueAyristir(kayit.githubIssueUrl!);
    if (!ayrik) continue;
    try {
      await yenidenDene(
        () =>
          octokit.issues.update({
            owner: config.owner,
            repo: ayrik.repo,
            issue_number: ayrik.number,
            state: "open",
          }),
        { ad: "issues.update" },
      );
      await prisma.stepIssue.update({ where: { id: kayit.id }, data: { status: "OPEN" } });
      acilan += 1;
    } catch (error) {
      // Tek bir issue açılamazsa diğerleri denenmeye devam etsin.
      logger.warn("Issue yeniden açılamadı", {
        stepId: params.stepId,
        neden: hataNedeni(error),
      });
    }
  }

  return { yenidenAcilan: acilan };
}
