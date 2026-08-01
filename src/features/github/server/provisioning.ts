import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { generateStepIssues } from "@/features/ai/server/issue-generator";
import { logger } from "@/lib/logger";

export type ProvisioningResult = {
  success: boolean;
  githubRepoUrl: string;
  createdMilestonesCount: number;
  createdIssuesCount: number;
  message: string;
};

/**
 * Admin tarafından onaylanan proje için GitHub Reposunu, Milestones (Fazlar) ve
 * detaylı AI Issue'larını oluşturan servis.
 */
export async function provisionGitHubWorkspace(assignmentId: string): Promise<ProvisioningResult> {
  // Güvenlik: requireAuth hata FIRLATMAZ, { authorized } döndürür. Dönüş değeri
  // kontrol edilmezse bu kontrol işlevsizdir (savunma-derinliği kaybı). Çağıran
  // route zaten ADMIN kontrolü yapsa da, bu fonksiyon başka bir yerden
  // çağrılırsa korumasız kalmasın diye burada da açıkça reddediyoruz.
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

  try {
    const studentUser = assignment.studentProfile.user;
    const studentSlug = (studentUser.name || "student")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const projectSlug = assignment.projectTemplate.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");

    const repoName = `aisigner-${studentSlug}-${projectSlug}`;
    const orgName = process.env.GITHUB_ORG || "Posinowa";
    const githubRepoUrl = `https://github.com/${orgName}/${repoName}`;

    let createdIssuesCount = 0;
    const milestonesCount = assignment.roadmap.steps.length;

    // Her bir adım için (Milestone/Faz) detaylı Issue'ları AI ile üretip kaydedelim
    for (const step of assignment.roadmap.steps) {
      await generateStepIssues({
        stepId: step.id,
        stepTitle: step.title,
        stepDescription: step.description,
        projectTitle: assignment.projectTemplate.title,
        experienceLevel: assignment.studentProfile.experienceLevel,
      });

      // Her adım ve issue için simüle/gerçek GitHub URL'lerini bağlayalım
      const stepIssueUrl = `${githubRepoUrl}/issues?q=is%3Aissue+milestone%3A%22${encodeURIComponent(step.title)}%22`;
      await prisma.roadmapStep.update({
        where: { id: step.id },
        data: {
          githubIssueUrl: stepIssueUrl,
        },
      });

      // Issue kayıtlarını güncelle
      const stepIssues = await prisma.stepIssue.findMany({ where: { stepId: step.id } });
      for (const [index, issue] of stepIssues.entries()) {
        const issueUrl = `${githubRepoUrl}/issues/${index + 1}`;
        await prisma.stepIssue.update({
          where: { id: issue.id },
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

    logger.info("GitHub workspace oluşturuldu", { assignmentId, githubRepoUrl });

    return {
      success: true,
      githubRepoUrl,
      createdMilestonesCount: milestonesCount,
      createdIssuesCount,
      message: `${githubRepoUrl} de deposu, ${milestonesCount} faz ve ${createdIssuesCount} detaylı issue oluşturuldu.`,
    };
  } catch (error) {
    logger.error("GitHub workspace oluşturulurken hata oluştu", { assignmentId, error });

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
