// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #377 — ISSUE ÜRETİMİ ARTIK `cozVeDogrula`'DAN GEÇİYOR.
 *
 * Öncesinde ham `JSON.parse(text)` vardı. Model — `responseMimeType` istense
 * bile — çıktıyı ```json bloğuna sarabiliyor ya da başına açıklama
 * ekleyebiliyor. O durumda `JSON.parse` SyntaxError fırlatıyor ve akış
 * SESSİZCE mock içeriğe düşüyordu: mentör/öğrenci uydurma issue başlıklarıyla
 * çalışıyor ve bunu gerçek AI çıktısından ayırt edemiyordu.
 */

const { prismaMock, getModelMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    stepIssue: { deleteMany: vi.fn(), createMany: vi.fn(), count: vi.fn() },
  },
  getModelMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/ai/gemini-client", () => ({ getModel: getModelMock }));

import { generateStepIssues } from "./issue-generator";

const params = {
  stepId: "s1",
  stepTitle: "Faz 1",
  stepDescription: "aciklama",
  projectTitle: "Proje",
  experienceLevel: "BEGINNER",
};

const GECERLI = [
  { title: "Issue A", bodyMarkdown: "govde a" },
  { title: "Issue B", bodyMarkdown: "govde b" },
];

/** Modelin döndürdüğü ham metni ayarlar. */
function modelDondursun(text: string) {
  getModelMock.mockReturnValue({
    generateContent: vi.fn().mockResolvedValue({ text }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.stepIssue.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.stepIssue.count.mockResolvedValue(0);
  prismaMock.stepIssue.createMany.mockResolvedValue({ count: 2 });
});

describe("model çıktısı çözümleme", () => {
  it("düz JSON çözülür", async () => {
    modelDondursun(JSON.stringify(GECERLI));

    const s = await generateStepIssues(params);

    expect(s.map((i) => i.title)).toEqual(["Issue A", "Issue B"]);
  });

  it("⚠️ ```json BLOĞUNA sarılı çıktı çözülür — eski sürüm burada mock'a düşerdi", async () => {
    modelDondursun("```json\n" + JSON.stringify(GECERLI) + "\n```");

    const s = await generateStepIssues(params);

    expect(s.map((i) => i.title)).toEqual(["Issue A", "Issue B"]);
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it("başına AÇIKLAMA eklenmiş çıktı çözülür", async () => {
    modelDondursun("İşte istediğiniz issue'lar:\n\n" + JSON.stringify(GECERLI));

    const s = await generateStepIssues(params);
    expect(s.map((i) => i.title)).toEqual(["Issue A", "Issue B"]);
  });
});

describe("mock'a düşüş SESSİZ DEĞİL", () => {
  it("bozuk JSON'da fallback döner VE loglanır", async () => {
    modelDondursun("{bu json degil");

    const s = await generateStepIssues(params);

    expect(s.length).toBeGreaterThan(0);
    expect(s[0].title).not.toBe("Issue A");
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("ŞEMAYA uymayan çıktıda fallback döner VE loglanır", async () => {
    // `bodyMarkdown` yok — eski sürüm bunu sessizce kabul ederdi.
    modelDondursun(JSON.stringify([{ title: "eksik" }]));

    const s = await generateStepIssues(params);

    expect(s[0].title).not.toBe("eksik");
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("BOŞ liste kabul edilmez — 'üretildi' deyip hiçbir şey üretmemek daha sinsi", async () => {
    modelDondursun("[]");

    const s = await generateStepIssues(params);

    expect(s.length).toBeGreaterThan(0);
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("boş yanıtta fallback döner", async () => {
    modelDondursun("");

    const s = await generateStepIssues(params);
    expect(s.length).toBeGreaterThan(0);
  });

  it("fallback de veritabanına YAZILIR — adım issue'suz kalmaz", async () => {
    modelDondursun("bozuk");

    await generateStepIssues(params);

    expect(prismaMock.stepIssue.createMany).toHaveBeenCalled();
  });
});
