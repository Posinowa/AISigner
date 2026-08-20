import { describe, it, expect, beforeEach, vi } from "vitest";

// #218 review: storeGeneratedIssues'in GERÇEK silme yolunu doğruluyoruz — provisioning
// testinde bu fonksiyon mock'lu olduğu için oradaki yeşil tek başına yeterli değil.
const { prismaMock, getModelMock } = vi.hoisted(() => ({
  prismaMock: {
    stepIssue: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  },
  getModelMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/gemini-client", () => ({ getModel: getModelMock }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { generateStepIssues } from "./issue-generator";

const params = {
  stepId: "s1",
  stepTitle: "Faz 1",
  stepDescription: "d",
  projectTitle: "Proje",
  experienceLevel: "BEGINNER",
};

describe("storeGeneratedIssues — GitHub'a gönderilmiş kayıtları koru (#218 review)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.stepIssue.findMany.mockResolvedValue([]);
    // AI'ı hataya düşür → mock fallback yolu da storeGeneratedIssues'e gider.
    getModelMock.mockImplementation(() => {
      throw new Error("AI yok");
    });
  });

  it("deleteMany YALNIZCA githubIssueUrl=null satırları hedefler (URL'liler silinmez)", async () => {
    await generateStepIssues(params);

    expect(prismaMock.stepIssue.deleteMany).toHaveBeenCalledWith({
      where: { stepId: "s1", githubIssueUrl: null },
    });
  });

  it("korunan kayıt varsa yeni satırların order'ı onların ardından devam eder", async () => {
    // GitHub'a gönderilmiş 2 kayıt korunuyor (en büyük order = 2).
    prismaMock.stepIssue.findMany.mockResolvedValue([{ order: 2 }]);

    await generateStepIssues(params);

    const created = prismaMock.stepIssue.createMany.mock.calls[0][0].data as Array<{ order: number }>;
    expect(created[0].order).toBe(3);
    expect(created.every((d, i) => d.order === 3 + i)).toBe(true);
  });
});
