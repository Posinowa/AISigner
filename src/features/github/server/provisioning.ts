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
} from "./github-api";

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
  const studentSlug = (studentUser.name || "student")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const projectSlug = assignment.projectTemplate.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");

  const repoName = `aisigner-${studentSlug}-${projectSlug}`;
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
      const generatedIssues = await generateStepIssues({
        stepId: step.id,
        stepTitle: step.title,
        stepDescription: step.description,
        projectTitle: assignment.projectTemplate.title,
        experienceLevel: assignment.studentProfile.experienceLevel,
      });

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
        if (!milestoneResult.alreadyExisted) {
          createdThisRun.milestones.push(milestoneResult.milestoneNumber);
        }
      }

      await prisma.roadmapStep.update({
        where: { id: step.id },
        data: {
          githubIssueUrl: stepIssueUrl,
        },
      });

      // Issue kayıtlarını güncelle
      const stepIssues = await prisma.stepIssue.findMany({ where: { stepId: step.id } });
      for (const [index, dbIssue] of stepIssues.entries()) {
        // #179 review: İdempotent yeniden çalıştırma — bu issue GitHub'da zaten
        // açılıp URL'i kaydedilmişse tekrar açma (duplicate issue önlemi).
        if (realGitHub && dbIssue.githubIssueUrl) {
          skippedIssuesCount++;
          continue;
        }

        let issueUrl = `${githubRepoUrl}/issues/${index + 1}`;

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
          createdThisRun.issues.push(createdIssue.issueNumber);
        }

        await prisma.stepIssue.update({
          where: { id: dbIssue.id },
          data: {
            githubIssueUrl: issueUrl,
          },
        });
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

    // #179 review: Kısmi başarı telafisi. Bu çalışmada açılan issue ve milestone'lar
    // best-effort kapatılır ki GitHub'da yarım kalmış "açık görev" artığı kalmasın.
    // Repo BİLİNÇLİ olarak silinmez: öğrenci çalışması içerebilir ve idempotent
    // yeniden deneme (422 → yeniden kullan) onu tekrar kullanır.
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
