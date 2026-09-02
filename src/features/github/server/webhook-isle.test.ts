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

import { issueKapandiginiIsle, issueYenidenAcildiginiIsle } from "./webhook-isle";

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
      // #379: Kapanmanın merge'den gelip gelmediği KAYDEDİLİYOR — revizyon
      // istenince "yeni issue mu, yeniden açma mı" kararı buna bakıyor.
      data: { status: "CLOSED", mergeIleKapandi: false },
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

/**
 * #378 — YENİDEN AÇILMA.
 *
 * Webhook yalnız `closed` dinliyordu; yanlışlıkla kapatılan bir issue geri
 * açıldığında adım COMPLETED olarak kalıyor, kaynak ile ayna sessizce
 * ayrışıyordu.
 */
describe("issueYenidenAcildiginiIsle", () => {
  const acilma = (url = "https://github.com/o/r/issues/1") => ({
    action: "reopened",
    issue: { html_url: url },
  });

  beforeEach(() => {
    prismaMock.stepIssue.findFirst.mockResolvedValue({
      id: "si1",
      stepId: "st1",
      status: "CLOSED",
    });
    prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "COMPLETED" });
  });

  it("url yoksa sessizce geçer", async () => {
    const s = await issueYenidenAcildiginiIsle({ action: "reopened" });
    expect(s.islendi).toBe(false);
  });

  it("eşleşen StepIssue yoksa sessizce geçer", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue(null);

    const s = await issueYenidenAcildiginiIsle(acilma());

    expect(s.islendi).toBe(false);
    expect(durumDegistirMock).not.toHaveBeenCalled();
  });

  it("issue'yu OPEN işaretler", async () => {
    await issueYenidenAcildiginiIsle(acilma());

    expect(prismaMock.stepIssue.update).toHaveBeenCalledWith({
      where: { id: "si1" },
      data: { status: "OPEN" },
    });
  });

  it("TAMAMLANMIŞ adımı IN_PROGRESS'e geri çeker", async () => {
    const s = await issueYenidenAcildiginiIsle(acilma());

    expect(durumDegistirMock).toHaveBeenCalledWith({
      stepId: "st1",
      yeniDurum: "IN_PROGRESS",
      oncekiDurum: "COMPLETED",
      // Platform kullanıcısı yapmadı; GitHub'dan geldi.
      degistirenId: null,
    });
    expect(s.islendi).toBe(true);
  });

  it("⚠️ REVİZYON durumunu EZMEZ — #379 issue'yu kendisi yeniden açıyor", async () => {
    // #379 revizyon istendiğinde issue'yu reopen ediyor ve GitHub o olayı
    // bize geri gönderiyor. Körlemesine IN_PROGRESS yazsaydık mentörün az
    // önce koyduğu durumu kendi tetiklediğimiz olayla silerdik.
    prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "REVISION_REQUESTED" });

    const s = await issueYenidenAcildiginiIsle(acilma());

    expect(durumDegistirMock).not.toHaveBeenCalled();
    expect(s.aciklama).toContain("korundu");
  });

  it("zaten IN_PROGRESS olan adıma dokunmaz", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "IN_PROGRESS" });

    await issueYenidenAcildiginiIsle(acilma());

    expect(durumDegistirMock).not.toHaveBeenCalled();
  });

  it("zaten OPEN olan issue'ya gereksiz yazma yapmaz", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue({
      id: "si1",
      stepId: "st1",
      status: "OPEN",
    });

    await issueYenidenAcildiginiIsle(acilma());

    expect(prismaMock.stepIssue.update).not.toHaveBeenCalled();
  });
});
