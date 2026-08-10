import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  requireAuthMock,
  prismaMock,
  genIssuesMock,
  isGitHubConfiguredMock,
  createRepoMock,
  createMilestoneMock,
  createIssueMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    assignedProject: { findUnique: vi.fn(), update: vi.fn() },
    roadmapStep: { update: vi.fn() },
    stepIssue: { findMany: vi.fn(), update: vi.fn() },
  },
  genIssuesMock: vi.fn(),
  isGitHubConfiguredMock: vi.fn(),
  createRepoMock: vi.fn(),
  createMilestoneMock: vi.fn(),
  createIssueMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/ai/server/issue-generator", () => ({
  generateStepIssues: (...a: unknown[]) => genIssuesMock(...a),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("./github-api", () => ({
  isGitHubConfigured: () => isGitHubConfiguredMock(),
  createGitHubRepository: (...a: unknown[]) => createRepoMock(...a),
  createGitHubMilestone: (...a: unknown[]) => createMilestoneMock(...a),
  createGitHubIssue: (...a: unknown[]) => createIssueMock(...a),
}));

import { provisionGitHubWorkspace } from "./provisioning";

function admin() {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "a", role: "ADMIN" } } });
}

describe("provisionGitHubWorkspace (#178 & #179)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGitHubConfiguredMock.mockReturnValue(false); // varsayılan: token yok (simülasyon)
    genIssuesMock.mockResolvedValue([]);
    prismaMock.stepIssue.findMany.mockResolvedValue([]);
    prismaMock.assignedProject.update.mockResolvedValue({});
    prismaMock.roadmapStep.update.mockResolvedValue({});
  });

  it("yetkisizse hata fırlatır, DB'ye gidilmez", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow();
    expect(prismaMock.assignedProject.findUnique).not.toHaveBeenCalled();
  });

  it("atama yoksa hata fırlatır", async () => {
    admin();
    prismaMock.assignedProject.findUnique.mockResolvedValue(null);
    await expect(provisionGitHubWorkspace("yok")).rejects.toThrow(/bulunamadı/i);
  });

  it("token yokken simülasyon fallback çalışır: simulated=true döner", async () => {
    admin();
    isGitHubConfiguredMock.mockReturnValue(false);
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      id: "ap-1",
      studentProfile: { user: { name: "Ali" }, experienceLevel: "BEGINNER" },
      projectTemplate: { title: "Proje" },
      roadmap: { steps: [{ id: "s1", title: "Faz 1", description: "d" }] },
    });

    const res = await provisionGitHubWorkspace("ap-1");

    expect(res.simulated).toBe(true);
    expect(res.success).toBe(true);
    expect(res.message.toLowerCase()).toContain("simülasyon");
    expect(createRepoMock).not.toHaveBeenCalled();
  });

  it("GITHUB_TOKEN varken gerçek GitHub entegrasyonu çalışır (#179)", async () => {
    admin();
    isGitHubConfiguredMock.mockReturnValue(true);
    createRepoMock.mockResolvedValue({
      repoUrl: "https://github.com/Posinowa/aisigner-ali-proje",
      owner: "Posinowa",
      repo: "aisigner-ali-proje",
    });
    createMilestoneMock.mockResolvedValue({
      milestoneNumber: 1,
      htmlUrl: "https://github.com/Posinowa/aisigner-ali-proje/milestone/1",
    });
    createIssueMock.mockResolvedValue({
      issueNumber: 1,
      htmlUrl: "https://github.com/Posinowa/aisigner-ali-proje/issues/1",
    });
    genIssuesMock.mockResolvedValue([
      { title: "Task 1", bodyMarkdown: "Task 1 body" },
    ]);
    prismaMock.stepIssue.findMany.mockResolvedValue([
      { id: "iss-1", title: "Task 1", stepId: "s1" },
    ]);
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      id: "ap-1",
      studentProfile: { user: { name: "Ali" }, experienceLevel: "BEGINNER" },
      projectTemplate: { title: "Proje" },
      roadmap: { steps: [{ id: "s1", title: "Faz 1", description: "d" }] },
    });

    const res = await provisionGitHubWorkspace("ap-1");

    expect(res.simulated).toBe(false);
    expect(res.success).toBe(true);
    expect(res.githubRepoUrl).toBe("https://github.com/Posinowa/aisigner-ali-proje");
    expect(createRepoMock).toHaveBeenCalledOnce();
    expect(createMilestoneMock).toHaveBeenCalledOnce();
    expect(createIssueMock).toHaveBeenCalledOnce();
    expect(prismaMock.assignedProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          githubStatus: "PROVISIONED",
          githubRepoUrl: "https://github.com/Posinowa/aisigner-ali-proje",
        }),
      }),
    );
  });

  it("GitHub API hata verdiğinde githubStatus='ERROR' güncellenir ve hata fırlatılır", async () => {
    admin();
    isGitHubConfiguredMock.mockReturnValue(true);
    createRepoMock.mockRejectedValue(new Error("GitHub API 401: Bad credentials"));
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      id: "ap-1",
      studentProfile: { user: { name: "Ali" }, experienceLevel: "BEGINNER" },
      projectTemplate: { title: "Proje" },
      roadmap: { steps: [{ id: "s1", title: "Faz 1", description: "d" }] },
    });

    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow("Bad credentials");

    expect(prismaMock.assignedProject.update).toHaveBeenCalledWith({
      where: { id: "ap-1" },
      data: { githubStatus: "ERROR" },
    });
  });
});
