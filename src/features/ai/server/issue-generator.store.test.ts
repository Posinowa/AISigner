// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #269 — `storeGeneratedIssues` GitHub'a gönderilmiş kayıtları SİLMEMELİ.
 *
 * Önceki hâli `where: { stepId }` ile adımdaki her şeyi siliyordu; kayıtlı
 * `githubIssueUrl` bağlantıları kayboluyor ve bir sonraki provision GitHub'da
 * kopya issue açıyordu.
 *
 * BU TESTLER `generateStepIssues`'u MOCK'LAMAZ — asıl kusur, onu mock'layan
 * testlerin `deleteMany`'yi hiç koşturmamasıydı. Burada gerçek fonksiyon
 * çalışıyor, yalnızca AI istemcisi ve Prisma taklit ediliyor.
 */

const { prismaMock, getModelMock } = vi.hoisted(() => ({
  prismaMock: {
    stepIssue: { deleteMany: vi.fn(), createMany: vi.fn(), count: vi.fn() },
  },
  getModelMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/ai/gemini-client", () => ({ getModel: getModelMock }));

import { generateStepIssues } from "./issue-generator";

const params = {
  stepId: "s1",
  stepTitle: "Faz 1",
  stepDescription: "aciklama",
  projectTitle: "Proje",
  experienceLevel: "BEGINNER",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.stepIssue.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.stepIssue.createMany.mockResolvedValue({ count: 0 });
  prismaMock.stepIssue.count.mockResolvedValue(0);

  // AI'ı devre dışı bırak → fallback (mock) issue'lar üretilir ve
  // storeGeneratedIssues GERÇEKTEN çalışır.
  getModelMock.mockImplementation(() => {
    throw new Error("AI yapılandırılmadı");
  });
});

describe("storeGeneratedIssues — gönderilmiş kayıtlar korunur (#269)", () => {
  it("silme YALNIZCA githubIssueUrl null olan satırları hedefler", async () => {
    await generateStepIssues(params);

    expect(prismaMock.stepIssue.deleteMany).toHaveBeenCalledWith({
      where: { stepId: "s1", githubIssueUrl: null },
    });
  });

  it("adımdaki TÜM kayıtları silen eski davranış geri gelmemeli", async () => {
    await generateStepIssues(params);

    const where = prismaMock.stepIssue.deleteMany.mock.calls[0][0].where;
    expect(
      where,
      "githubIssueUrl koşulu olmadan silme bağlantıları yok eder",
    ).toHaveProperty("githubIssueUrl");
  });
});

describe("storeGeneratedIssues — order sürekliliği (#269)", () => {
  it("korunan kayıt yoksa numaralandırma 1'den başlar", async () => {
    prismaMock.stepIssue.count.mockResolvedValue(0);

    await generateStepIssues(params);

    const satirlar = prismaMock.stepIssue.createMany.mock.calls[0][0].data;
    expect(satirlar[0].order).toBe(1);
  });

  it("korunan kayıt varsa yeni satırlar onların ARDINDAN numaralanır", async () => {
    // Aksi halde order çakışır ve sıralama bozulur.
    prismaMock.stepIssue.count.mockResolvedValue(2);

    await generateStepIssues(params);

    const satirlar = prismaMock.stepIssue.createMany.mock.calls[0][0].data;
    expect(satirlar[0].order).toBe(3);
    expect(satirlar[1].order).toBe(4);
  });

  it("korunan kayıt sayısı silmeden SONRA okunur", async () => {
    // Önce okunsaydı, silinecek satırlar da sayılır ve order şişerdi.
    const sira: string[] = [];
    prismaMock.stepIssue.deleteMany.mockImplementation(async () => {
      sira.push("delete");
      return { count: 0 };
    });
    prismaMock.stepIssue.count.mockImplementation(async () => {
      sira.push("count");
      return 0;
    });

    await generateStepIssues(params);

    expect(sira).toEqual(["delete", "count"]);
  });
});
