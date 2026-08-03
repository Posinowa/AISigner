import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, genIssuesMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    assignedProject: { findUnique: vi.fn(), update: vi.fn() },
    roadmapStep: { update: vi.fn() },
    stepIssue: { findMany: vi.fn(), update: vi.fn() },
  },
  genIssuesMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/ai/server/issue-generator", () => ({
  generateStepIssues: (...a: unknown[]) => genIssuesMock(...a),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { provisionGitHubWorkspace } from "./provisioning";

function admin() {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "a", role: "ADMIN" } } });
}

describe("provisionGitHubWorkspace (#178-1/2/3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("başarı: simulated=true döner ve mesaj simülasyon olduğunu belirtir", async () => {
    admin();
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
  });
});
