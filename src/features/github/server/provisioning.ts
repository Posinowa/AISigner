import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { generateStepIssues } from "@/features/ai/server/issue-generator";
import { logger } from "@/lib/logger";
import {
  isGitHubConfigured,
  createGitHubRepository,
  createGitHubMilestone,
  createGitHubIssue,
  closeGitHubIssue,
  closeGitHubMilestone,
  ensureGitHubIssueOpen,
  ensureGitHubMilestoneOpen,
} from "./github-api";

/** Telafi takip listesinden bir numarayı çıkarır (persist edilenler kapatılmaz). */
function removeFrom(list: number[], value: number): void {
  const i = list.indexOf(value);
  if (i !== -1) list.splice(i, 1);
}

/** Türkçe/aksanlı harfleri ASCII'ye indirger. */
const TR_MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};

/**
 * #179 review: GitHub repo adı için ASCII-güvenli slug.
 * Türkçe harfler karşılığına çevrilir (silinmez), kalan geçersiz karakterler tireye
 * dönüşür, baştaki/sondaki tireler kırpılır. Boş sonuç çağıran tarafta fallback'lenir.
 */
export function toAsciiSlug(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[çğıöşüâîû]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // kalan aksanlar
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Atama id'sinden deterministik, kısa ve ASCII-güvenli benzersiz sonek. */
export function shortId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return clean.slice(-6) || "000000";
}

export type ProvisioningResult = {
  success: boolean;
  githubRepoUrl: string;
  createdMilestonesCount: number;
  createdIssuesCount: number;
  message: string;
  simulated: boolean;
};

/**
 * #179: Öğrenci için GitHub çalışma alanı (Repo, Milestone ve Issue'lar) oluşturur.
 *
 * `GITHUB_TOKEN` tanımlıysa:
 * - GitHub REST API aracılığıyla organizasyon altında gerçek repo açılır,
 * - Roadmap adımları Milestone olarak, AI tarafından türetilen görevler ise
 *   zengin Markdown formatında Issue olarak GitHub'a gönderilir.
 *
 * `GITHUB_TOKEN` tanımlı DEĞİLSE:
 * - Geliştirme kolaylığı için simülasyon / önizleme modunda çalışır (`simulated: true`).
 */
export async function provisionGitHubWorkspace(assignmentId: string): Promise<ProvisioningResult> {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.authorized) {
    throw new Error("Bu işlem için yönetici yetkisi gerekiyor");
  }

  const assignment = await prisma.assignedProject.findUnique({
    where: { id: assignmentId },
    include: {
      studentProfile: {
        include: {
          user: true,
        },
      },
      projectTemplate: true,
      roadmap: {
        include: {
          steps: {
            orderBy: { order: "asc" },
            include: {
              issues: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Proje ataması bulunamadı");
  }

  if (!assignment.roadmap || assignment.roadmap.steps.length === 0) {
    throw new Error("Bu projeye ait onaylanmış bir Roadmap ve adım bulunmuyor");
  }

  // Durumu PROVISIONING yap
  await prisma.assignedProject.update({
    where: { id: assignmentId },
    data: {
      githubStatus: "PROVISIONING",
    },
  });

  const studentUser = assignment.studentProfile.user;
  // #179 review: Eski slug Türkçe karakterleri SİLİYORDU ("Öğrenci" → "" gibi) ve
  // repo adında benzersizlik yoktu. Aynı şablona atanan iki öğrenci aynı repo adına
  // düşüyor, 422 "zaten var" ise ÖTEKİNİN reposu yanlışlıkla yeniden kullanılıyordu.
  // Çözüm: Türkçe harfleri ASCII'ye çevir, boş kalırsa fallback, sonuna atamaya özel
  // (deterministik → re-run aynı adı üretir) benzersiz sonek ekle.
  const studentSlug = toAsciiSlug(studentUser.name) || "student";
  const projectSlug = toAsciiSlug(assignment.projectTemplate.title) || "proje";
  const uniqueSuffix = shortId(assignment.id);

  const repoName = `aisigner-${studentSlug}-${projectSlug}-${uniqueSuffix}`;
  const orgName = process.env.GITHUB_ORG || "Posinowa";
  const realGitHub = isGitHubConfigured();

  let githubRepoUrl = `https://github.com/${orgName}/${repoName}`;
  let owner = orgName;
  let repo = repoName;

  // #179 review: Kısmi başarı telafisi için BU ÇALIŞMADA açılan kaynakları izle.
  // Hata olursa açılan issue/milestone'lar kapatılır ve envanter loglanır
  // (repo silinmez — öğrenci çalışması içerebilir, yeniden deneme onu kullanır).
  // catch bloğundan erişilebilmesi için try DIŞINDA tanımlanır.
  const createdThisRun: {
    repoCreated: boolean;
    milestones: number[];
    issues: number[];
  } = { repoCreated: false, milestones: [], issues: [] };

  try {
    // #179: GITHUB_TOKEN tanımlıysa gerçek GitHub reposu aç
    if (realGitHub) {
      const repoResult = await createGitHubRepository({
        orgOrOwner: orgName,
        repoName,
        description: `AISigner: ${assignment.studentProfile.user.name || "Öğrenci"} - ${assignment.projectTemplate.title}`,
      });
      githubRepoUrl = repoResult.repoUrl;
      owner = repoResult.owner;
      repo = repoResult.repo;
      createdThisRun.repoCreated = !repoResult.alreadyExisted;
    }

    let createdIssuesCount = 0;
    // #179: idempotent re-run'da atlanan (zaten GitHub'da açık) issue sayısı.
    let skippedIssuesCount = 0;
    const milestonesCount = assignment.roadmap.steps.length;

    // Her bir adım için (Milestone/Faz) detaylı Issue'ları AI ile üretip kaydedelim
    for (const step of assignment.roadmap.steps) {
      // #218 review [P1]: Mevcut kayıtları generate'ten ÖNCE oku.
      //
      // `generateStepIssues` → `storeGeneratedIssues` içinde `stepIssue.deleteMany`
      // çalışır. Bu adımda GitHub'a gönderilmiş (githubIssueUrl dolu) kayıtlar varsa
      // yeniden üretmek onları SİLER; aşağıdaki "URL varsa atla" dalı hiç çalışmaz ve
      // ikinci provision GitHub'da DUPLICATE issue açar, öğrencinin görev linkleri
      // kaybolur. Bu yüzden provision edilmiş adımda AI'yı hiç çağırmıyoruz
      // (aynı zamanda gereksiz AI maliyetini de önler).
      const existingIssues = await prisma.stepIssue.findMany({ where: { stepId: step.id } });
      const hasProvisionedIssues = existingIssues.some((i) => i.githubIssueUrl);

      let generatedIssues: Awaited<ReturnType<typeof generateStepIssues>> = [];
      if (hasProvisionedIssues) {
        logger.info("Adımda GitHub'a gönderilmiş issue var — AI üretimi atlandı (idempotent)", {
          stepId: step.id,
          assignmentId,
        });
      } else {
        generatedIssues = await generateStepIssues({
          stepId: step.id,
          stepTitle: step.title,
          stepDescription: step.description,
          projectTitle: assignment.projectTemplate.title,
          experienceLevel: assignment.studentProfile.experienceLevel,
        });
      }

      let milestoneNumber: number | undefined;
      let stepIssueUrl = `${githubRepoUrl}/issues?q=is%3Aissue+milestone%3A%22${encodeURIComponent(step.title)}%22`;

      if (realGitHub) {
        const milestoneResult = await createGitHubMilestone({
          owner,
          repo,
          title: step.title,
          description: step.description,
        });
        milestoneNumber = milestoneResult.milestoneNumber;
        stepIssueUrl = milestoneResult.htmlUrl;
        if (milestoneResult.alreadyExisted) {
          // #218 review: Yeniden kullanılan milestone önceki telafide kapatılmış
          // olabilir → öğrenci kapalı faza yönlenmesin diye aç.
          await ensureGitHubMilestoneOpen({ owner, repo, milestoneNumber });
        } else {
          createdThisRun.milestones.push(milestoneResult.milestoneNumber);
        }
      }

      await prisma.roadmapStep.update({
        where: { id: step.id },
        data: {
          githubIssueUrl: stepIssueUrl,
        },
      });

      // #179 review: URL DB'ye yazıldı → bu milestone artık "persist edilmiş"tir ve
      // telafide KAPATILMAMALIDIR (aksi halde öğrenci kapalı bir faza yönlenir ve
      // idempotent re-run onu diriltmez). Takip listesinden çıkarıyoruz.
      if (milestoneNumber !== undefined) {
        removeFrom(createdThisRun.milestones, milestoneNumber);
      }

      // Issue kayıtlarını güncelle. Generate ÇALIŞTIYSA satırlar yeniden yazıldığı
      // için tazelenmeli; atlandıysa yukarıda okunan (URL'li) kayıtlar geçerlidir.
      const stepIssues = hasProvisionedIssues
        ? existingIssues
        : await prisma.stepIssue.findMany({ where: { stepId: step.id } });
      for (const [index, dbIssue] of stepIssues.entries()) {
        // #179 review: İdempotent yeniden çalıştırma — bu issue GitHub'da zaten
        // açılıp URL'i kaydedilmişse tekrar AÇMA (duplicate önlemi). Ancak issue
        // bir önceki denemede kapatılmış olabilir; öğrenci kapalı göreve yönlenmesin
        // diye kapalıysa YENİDEN AÇ.
        if (realGitHub && dbIssue.githubIssueUrl) {
          await ensureGitHubIssueOpen({ owner, repo, issueUrl: dbIssue.githubIssueUrl });
          skippedIssuesCount++;
          continue;
        }

        let issueUrl = `${githubRepoUrl}/issues/${index + 1}`;
        let createdIssueNumber: number | undefined;

        if (realGitHub) {
          const spec = generatedIssues.find((g) => g.title === dbIssue.title) || generatedIssues[index];
          const body = spec ? spec.bodyMarkdown : `**${dbIssue.title}**\n\n${step.title} adımı için görev.`;
          const createdIssue = await createGitHubIssue({
            owner,
            repo,
            title: dbIssue.title,
            body,
            milestoneNumber,
          });
          issueUrl = createdIssue.htmlUrl;
          createdIssueNumber = createdIssue.issueNumber;
          createdThisRun.issues.push(createdIssue.issueNumber);
        }

        await prisma.stepIssue.update({
          where: { id: dbIssue.id },
          data: {
            githubIssueUrl: issueUrl,
          },
        });

        // #179 review: URL persist edildi → telafide bu issue KAPATILMAZ.
        // (Yalnızca "açıldı ama DB'ye yazılamadı" olanlar kapatılır.)
        if (createdIssueNumber !== undefined) {
          removeFrom(createdThisRun.issues, createdIssueNumber);
        }
        createdIssuesCount++;
      }
    }

    // Atamayı PROVISIONED yap
    await prisma.assignedProject.update({
      where: { id: assignmentId },
      data: {
        githubRepoUrl,
        githubStatus: "PROVISIONED",
        provisionedAt: new Date(),
        status: "IN_PROGRESS",
      },
    });

    logger.info("GitHub workspace oluşturuldu", { assignmentId, githubRepoUrl, simulated: !realGitHub });

    return {
      success: true,
      githubRepoUrl,
      createdMilestonesCount: milestonesCount,
      createdIssuesCount,
      simulated: !realGitHub,
      message: realGitHub
        ? `GitHub çalışma alanı (${milestonesCount} faz, ${createdIssuesCount} issue) başarıyla oluşturuldu.` +
          // #179: İdempotent yeniden çalıştırmada zaten açık olan issue'lar atlanır.
          (skippedIssuesCount > 0
            ? ` ${skippedIssuesCount} issue daha önce açıldığı için atlandı.`
            : "")
        : `Önizleme: ${milestonesCount} faz ve ${createdIssuesCount} detaylı issue hazırlandı. (Not: GITHUB_TOKEN tanımlı olmadığı için simülasyon modunda çalıştırıldı.)`,
    };
  } catch (error) {
    logger.error("GitHub workspace oluşturulurken hata oluştu", { assignmentId, error });

    // #179 review: Kısmi başarı telafisi — YALNIZCA PERSIST EDİLMEMİŞ kaynaklar.
    //
    // Sözleşme: GitHub'da açıldı ama URL'i DB'ye yazılamadı → öksüz, kapatılır.
    // URL'i DB'ye yazılanlar listeden çıkarıldığı için burada KAPATILMAZ; aksi halde
    // öğrenci kapalı bir issue/milestone linkine giderdi ve idempotent re-run
    // (URL var → atla) onu diriltmezdi.
    //
    // Repo BİLİNÇLİ olarak silinmez: öğrenci çalışması içerebilir ve yeniden deneme
    // (422 → yeniden kullan) onu tekrar kullanır.
    if (realGitHub && (createdThisRun.issues.length > 0 || createdThisRun.milestones.length > 0)) {
      const closedIssues: number[] = [];
      const failedIssues: number[] = [];
      for (const issueNumber of createdThisRun.issues) {
        const ok = await closeGitHubIssue({ owner, repo, issueNumber });
        (ok ? closedIssues : failedIssues).push(issueNumber);
      }

      const closedMilestones: number[] = [];
      const failedMilestones: number[] = [];
      for (const milestoneNumber of createdThisRun.milestones) {
        const ok = await closeGitHubMilestone({ owner, repo, milestoneNumber });
        (ok ? closedMilestones : failedMilestones).push(milestoneNumber);
      }

      logger.warn("GitHub provisioning telafisi uygulandı (kısmi başarı geri alındı)", {
        assignmentId,
        owner,
        repo,
        repoCreatedThisRun: createdThisRun.repoCreated,
        closedIssues,
        failedIssues,
        closedMilestones,
        failedMilestones,
      });
    }

    // Telafi edilemeyen/temizlenemeyen kaynakların envanteri — güvenli yeniden
    // deneme ve manuel inceleme için kayıt altına alınır.
    if (realGitHub) {
      logger.error("GitHub provisioning envanteri (yeniden deneme güvenli: repo/milestone 422 ile, issue kayıtlı URL ile atlanır)", {
        assignmentId,
        githubRepoUrl,
        repoCreatedThisRun: createdThisRun.repoCreated,
        createdMilestones: createdThisRun.milestones,
        createdIssues: createdThisRun.issues,
      });
    }

    await prisma.assignedProject.update({
      where: { id: assignmentId },
      data: {
        githubStatus: "ERROR",
      },
    });

    throw new Error(
      error instanceof Error ? error.message : "GitHub çalışma alanı oluşturulurken beklenmeyen bir hata oluştu"
    );
  }
}
