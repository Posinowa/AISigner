// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Revizyonun GitHub'a yansıtılması (#379).
 *
 * ⚠️ KİLİTLENEN KURAL: MERGE EDİLDİYSE YENİ ISSUE, EDİLMEDİYSE YENİDEN AÇ.
 *
 * Merge edilmiş bir işin issue'sunu yeniden açmak, ana dalda DURAN kodu
 * "yapılmamış" gibi gösterirdi. O iş bitti; revizyon yeni bir iştir.
 */

const { prismaMock, octokitMock, issueHazirlaMock, configMock } = vi.hoisted(() => ({
  prismaMock: {
    roadmapStep: { findUnique: vi.fn() },
    stepIssue: { findMany: vi.fn(), update: vi.fn() },
  },
  octokitMock: { issues: { update: vi.fn() } },
  issueHazirlaMock: vi.fn(),
  configMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("./client", async () => {
  const gercek = await vi.importActual<typeof import("./client")>("./client");
  return { ...gercek, readGitHubConfig: configMock, getOctokit: () => octokitMock };
});
vi.mock("./repo", () => ({ issueHazirla: issueHazirlaMock }));
vi.mock("./retry", () => ({ yenidenDene: (f: () => unknown) => f() }));

import { revizyonuGitHubaYansit } from "./revizyon-senk";

const URL1 = "https://github.com/Posinowa/depo/issues/7";
const URL2 = "https://github.com/Posinowa/depo/issues/8";

const adim = (githubStatus = "PROVISIONED") => ({
  title: "Faz 1: Kurulum",
  roadmap: { assignedProject: { githubRepoUrl: "https://github.com/Posinowa/depo", githubStatus } },
});

const cagir = () => revizyonuGitHubaYansit({ stepId: "st-1", gerekce: "Testler eksik." });

beforeEach(() => {
  vi.clearAllMocks();
  configMock.mockReturnValue({ token: "t", owner: "Posinowa" });
  prismaMock.roadmapStep.findUnique.mockResolvedValue(adim());
  prismaMock.stepIssue.update.mockResolvedValue({});
  octokitMock.issues.update.mockResolvedValue({});
  issueHazirlaMock.mockResolvedValue({ ok: true, olusturuldu: true, veri: { htmlUrl: "yeni-url" } });
});

describe("merge EDİLMEMİŞ iş → mevcut issue yeniden açılır", () => {
  beforeEach(() => {
    prismaMock.stepIssue.findMany.mockResolvedValue([
      { id: "si-1", githubIssueUrl: URL1, title: "a", mergeIleKapandi: false },
      { id: "si-2", githubIssueUrl: URL2, title: "b", mergeIleKapandi: false },
    ]);
  });

  it("her issue'yu 'open' yapar", async () => {
    const s = await cagir();

    expect(s.yenidenAcilan).toBe(2);
    expect(octokitMock.issues.update).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "depo", issue_number: 7, state: "open" }),
    );
    expect(issueHazirlaMock).not.toHaveBeenCalled();
  });

  it("veritabanındaki durumu da OPEN'a çeker", async () => {
    await cagir();
    expect(prismaMock.stepIssue.update).toHaveBeenCalledWith({
      where: { id: "si-1" },
      data: { status: "OPEN" },
    });
  });

  it("bir issue açılamazsa DİĞERLERİ denenmeye devam eder", async () => {
    octokitMock.issues.update.mockRejectedValueOnce(Object.assign(new Error("gh"), { status: 500 }));

    const s = await cagir();
    expect(s.yenidenAcilan).toBe(1);
  });
});

describe("merge EDİLMİŞ iş → YENİ issue", () => {
  beforeEach(() => {
    prismaMock.stepIssue.findMany.mockResolvedValue([
      { id: "si-1", githubIssueUrl: URL1, title: "a", mergeIleKapandi: true },
    ]);
  });

  it("eski issue YENİDEN AÇILMAZ — kod ana dalda, o iş bitti", async () => {
    const s = await cagir();

    expect(octokitMock.issues.update).not.toHaveBeenCalled();
    expect(s.yenidenAcilan).toBe(0);
    expect(s.yeniIssueUrl).toBe("yeni-url");
  });

  it("yeni issue GEREKÇEYİ taşır", async () => {
    await cagir();
    const govde = issueHazirlaMock.mock.calls[0][1];
    expect(govde.body).toContain("Testler eksik.");
    expect(govde.title).toContain("Revizyon");
  });

  it("issue açılamazsa AKIŞ ÇÖKMEZ", async () => {
    issueHazirlaMock.mockResolvedValue({ ok: false, neden: "yetki-yok" });
    await expect(cagir()).resolves.toEqual({ yenidenAcilan: 0 });
  });
});

describe("atlanan durumlar", () => {
  it("GitHub yapılandırılmamışsa sessizce atlar", async () => {
    configMock.mockReturnValue(null);
    expect(await cagir()).toEqual({ yenidenAcilan: 0, atlandi: "yapilandirma-yok" });
  });

  it("DIŞ DEPOYA (BAGLA) dokunmaz — orada yetkimiz yok (#366)", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(adim("LINKED"));

    expect(await cagir()).toEqual({ yenidenAcilan: 0, atlandi: "dis-depo" });
    expect(octokitMock.issues.update).not.toHaveBeenCalled();
    expect(issueHazirlaMock).not.toHaveBeenCalled();
  });

  it("repo yoksa atlar", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue({
      title: "x",
      roadmap: { assignedProject: { githubRepoUrl: null, githubStatus: "NOT_PROVISIONED" } },
    });
    expect(await cagir()).toEqual({ yenidenAcilan: 0, atlandi: "repo-yok" });
  });

  it("bağlı issue yoksa atlar", async () => {
    prismaMock.stepIssue.findMany.mockResolvedValue([]);
    expect(await cagir()).toEqual({ yenidenAcilan: 0, atlandi: "issue-yok" });
  });
});
