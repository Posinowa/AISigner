import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock, durumDegistirMock } = vi.hoisted(() => ({
  prismaMock: {
    stepIssue: { findFirst: vi.fn(), update: vi.fn(), count: vi.fn() },
    roadmapStep: { findUnique: vi.fn() },
  },
  durumDegistirMock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/features/roadmap/server/step-status", () => ({
  adimDurumunuDegistir: (...a: unknown[]) => durumDegistirMock(...a),
}));

import { issueKapandiginiIsle } from "./webhook-isle";

const olay = (url = "https://github.com/o/r/issues/1") => ({
  action: "closed",
  issue: { html_url: url },
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.stepIssue.update.mockResolvedValue({});
  prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "IN_PROGRESS" });
  durumDegistirMock.mockResolvedValue({});
});

describe("issueKapandiginiIsle", () => {
  it("eşleşen StepIssue yoksa sessizce geçer", async () => {
    // Repoda bizim açmadığımız issue'lar olabilir; bu bir hata değil.
    prismaMock.stepIssue.findFirst.mockResolvedValue(null);

    const s = await issueKapandiginiIsle(olay());

    expect(s.islendi).toBe(false);
    expect(durumDegistirMock).not.toHaveBeenCalled();
  });

  it("issue'yu CLOSED işaretler", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue({ id: "si1", stepId: "s1", status: "OPEN" });
    prismaMock.stepIssue.count.mockResolvedValue(2);

    await issueKapandiginiIsle(olay());

    expect(prismaMock.stepIssue.update).toHaveBeenCalledWith({
      where: { id: "si1" },
      data: { status: "CLOSED" },
    });
  });

  it("adımda AÇIK issue kaldıysa adım tamamlanmaz", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue({ id: "si1", stepId: "s1", status: "OPEN" });
    prismaMock.stepIssue.count.mockResolvedValue(1);

    const s = await issueKapandiginiIsle(olay());

    expect(s.aciklama).toContain("açık issue kaldı");
    expect(durumDegistirMock).not.toHaveBeenCalled();
  });

  it("TÜM issue'lar kapandığında adımı COMPLETED yapar", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue({ id: "si1", stepId: "s1", status: "OPEN" });
    prismaMock.stepIssue.count.mockResolvedValue(0);

    await issueKapandiginiIsle(olay());

    expect(durumDegistirMock).toHaveBeenCalledWith({
      stepId: "s1",
      yeniDurum: "COMPLETED",
      oncekiDurum: "IN_PROGRESS",
      // Platform kullanıcısı yapmadı — geçmişte (#324) bu görünmeli.
      degistirenId: null,
    });
  });

  // BİLİNÇLİ SAPMA: öğrenci ucu "önce başlat" kuralını dayatıyor. Webhook'ta
  // GitHub kanıt sunuyor — iş yapıldı. Aynı kuralı burada da dayatmak GitHub
  // ile platformu kalıcı tutarsız bırakırdı.
  it("adım TODO olsa bile tamamlar (öğrenci ucundaki kural burada geçerli değil)", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue({ id: "si1", stepId: "s1", status: "OPEN" });
    prismaMock.stepIssue.count.mockResolvedValue(0);
    prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "TODO" });

    await issueKapandiginiIsle(olay());

    expect(durumDegistirMock).toHaveBeenCalledWith(
      expect.objectContaining({ yeniDurum: "COMPLETED", oncekiDurum: "TODO" }),
    );
  });

  it("adım ZATEN tamamlanmışsa tekrar yazmaz (geçmişe sahte kayıt düşmesin)", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue({ id: "si1", stepId: "s1", status: "OPEN" });
    prismaMock.stepIssue.count.mockResolvedValue(0);
    prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "COMPLETED" });

    await issueKapandiginiIsle(olay());

    expect(durumDegistirMock).not.toHaveBeenCalled();
  });

  it("PR olaylarında pull_request.html_url kullanılır", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue(null);

    await issueKapandiginiIsle({
      action: "closed",
      pull_request: { html_url: "https://github.com/o/r/pull/7" },
    });

    expect(prismaMock.stepIssue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { githubIssueUrl: "https://github.com/o/r/pull/7" },
      }),
    );
  });

  it("url yoksa patlamaz", async () => {
    const s = await issueKapandiginiIsle({ action: "closed" });
    expect(s.islendi).toBe(false);
  });
});
