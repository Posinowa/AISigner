// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #255 — repo/milestone/issue işlemleri İDEMPOTENT olmalı.
 *
 * "Çalışma alanını güncelle" akışı bu davranışa dayanacak: aynı çağrı ikinci
 * kez yapıldığında repo kopya milestone/issue ile dolmamalı. Bu testler o
 * garantiyi kilitliyor.
 */

const { octokitMock } = vi.hoisted(() => ({
  octokitMock: {
    repos: { get: vi.fn(), createInOrg: vi.fn() },
    issues: {
      listMilestones: vi.fn(),
      createMilestone: vi.fn(),
      listForRepo: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("./client", async () => {
  const gercek = await vi.importActual<typeof import("./client")>("./client");
  return { ...gercek, getOctokit: () => octokitMock };
});

import { repoyuHazirla, milestoneHazirla, issueHazirla, repoAdiUret } from "./repo";

const config = { token: "t", owner: "Posinowa" };

/** GitHub 404'ü Octokit'te `status` taşıyan bir hata olarak gelir. */
const httpHata = (status: number) => Object.assign(new Error("gh"), { status });

beforeEach(() => vi.clearAllMocks());

describe("repoAdiUret", () => {
  it("Türkçe karakterleri çevirir", () => {
    expect(repoAdiUret(["Ayşe", "Güncel Proje"])).toBe("ayse-guncel-proje");
  });

  it("geçersiz karakterleri tireye indirger", () => {
    expect(repoAdiUret(["A!!!B", "C/D"])).toBe("a-b-c-d");
  });

  it("baştaki/sondaki tireleri kırpar", () => {
    expect(repoAdiUret(["...proje..."])).toBe("proje");
  });

  it("tamamen geçersiz girdide anlamlı bir ada düşer", () => {
    expect(repoAdiUret(["!!!"])).toBe("aisigner-proje");
  });

  it("çok uzun adı kısaltır", () => {
    expect(repoAdiUret(["x".repeat(200)]).length).toBeLessThanOrEqual(90);
  });
});

describe("repoyuHazirla — idempotent", () => {
  it("repo varsa YENİDEN OLUŞTURULMAZ", async () => {
    octokitMock.repos.get.mockResolvedValue({
      data: { name: "mevcut", html_url: "https://github.com/Posinowa/mevcut" },
    });

    const r = await repoyuHazirla(config, { repoName: "mevcut", description: "d" });

    expect(r).toMatchObject({ ok: true, olusturuldu: false });
    expect(octokitMock.repos.createInOrg, "var olan repo yeniden açılmamalı").not.toHaveBeenCalled();
  });

  it("repo yoksa oluşturulur", async () => {
    octokitMock.repos.get.mockRejectedValue(httpHata(404));
    octokitMock.repos.createInOrg.mockResolvedValue({
      data: { name: "yeni", html_url: "https://github.com/Posinowa/yeni" },
    });

    const r = await repoyuHazirla(config, { repoName: "yeni", description: "d" });

    expect(r).toMatchObject({ ok: true, olusturuldu: true });
    expect(octokitMock.repos.createInOrg).toHaveBeenCalled();
  });

  it("repo varsayılan olarak private açılır", async () => {
    octokitMock.repos.get.mockRejectedValue(httpHata(404));
    octokitMock.repos.createInOrg.mockResolvedValue({
      data: { name: "y", html_url: "u" },
    });

    await repoyuHazirla(config, { repoName: "y", description: "d" });

    expect(octokitMock.repos.createInOrg.mock.calls[0][0].private).toBe(true);
  });

  it("yetki hatasında OLUŞTURMAYI DENEMEZ", async () => {
    // 404 dışındaki hata "yok" demek değil; körlemesine oluşturmak tehlikeli.
    octokitMock.repos.get.mockRejectedValue(httpHata(403));

    const r = await repoyuHazirla(config, { repoName: "x", description: "d" });

    expect(r).toEqual({ ok: false, neden: "yetki-yok" });
    expect(octokitMock.repos.createInOrg).not.toHaveBeenCalled();
  });

  it("oluşturma hatası yapılandırılmış sonuca çevrilir, fırlatılmaz", async () => {
    octokitMock.repos.get.mockRejectedValue(httpHata(404));
    octokitMock.repos.createInOrg.mockRejectedValue(httpHata(403));

    const r = await repoyuHazirla(config, { repoName: "x", description: "d" });
    expect(r).toEqual({ ok: false, neden: "yetki-yok" });
  });
});

describe("milestoneHazirla — idempotent", () => {
  it("aynı başlıklı milestone varsa yeniden oluşturulmaz", async () => {
    octokitMock.issues.listMilestones.mockResolvedValue({
      data: [{ number: 3, title: "Faz 1" }],
    });

    const r = await milestoneHazirla(config, { repoName: "r", title: "Faz 1" });

    expect(r).toMatchObject({ ok: true, olusturuldu: false, veri: { number: 3 } });
    expect(octokitMock.issues.createMilestone).not.toHaveBeenCalled();
  });

  it("kapalı milestone da kopya sayılır", async () => {
    // state: "all" ile listelenmezse kapanmış fazın kopyası açılırdı.
    octokitMock.issues.listMilestones.mockResolvedValue({
      data: [{ number: 9, title: "Faz 2" }],
    });

    await milestoneHazirla(config, { repoName: "r", title: "Faz 2" });

    expect(octokitMock.issues.listMilestones.mock.calls[0][0].state).toBe("all");
    expect(octokitMock.issues.createMilestone).not.toHaveBeenCalled();
  });

  it("yoksa oluşturulur", async () => {
    octokitMock.issues.listMilestones.mockResolvedValue({ data: [] });
    octokitMock.issues.createMilestone.mockResolvedValue({
      data: { number: 1, title: "Faz 1" },
    });

    const r = await milestoneHazirla(config, { repoName: "r", title: "Faz 1" });
    expect(r).toMatchObject({ ok: true, olusturuldu: true });
  });

  it("listeleme hatasında oluşturmayı denemez", async () => {
    octokitMock.issues.listMilestones.mockRejectedValue(httpHata(404));

    const r = await milestoneHazirla(config, { repoName: "r", title: "F" });
    expect(r).toEqual({ ok: false, neden: "bulunamadi" });
    expect(octokitMock.issues.createMilestone).not.toHaveBeenCalled();
  });
});

describe("issueHazirla — idempotent", () => {
  it("aynı başlıklı issue varsa yeniden oluşturulmaz", async () => {
    octokitMock.issues.listForRepo.mockResolvedValue({
      data: [{ number: 7, title: "Görev A", html_url: "u7" }],
    });

    const r = await issueHazirla(config, {
      repoName: "r",
      title: "Görev A",
      body: "b",
    });

    expect(r).toMatchObject({ ok: true, olusturuldu: false, veri: { number: 7 } });
    expect(octokitMock.issues.create, "kopya issue açılmamalı").not.toHaveBeenCalled();
  });

  it("yoksa oluşturulur ve milestone'a bağlanır", async () => {
    octokitMock.issues.listForRepo.mockResolvedValue({ data: [] });
    octokitMock.issues.create.mockResolvedValue({
      data: { number: 1, title: "Görev A", html_url: "u1" },
    });

    const r = await issueHazirla(config, {
      repoName: "r",
      title: "Görev A",
      body: "b",
      milestoneNumber: 4,
    });

    expect(r).toMatchObject({ ok: true, olusturuldu: true });
    expect(octokitMock.issues.create.mock.calls[0][0].milestone).toBe(4);
  });

  it("kapalı issue da kopya sayılır", async () => {
    octokitMock.issues.listForRepo.mockResolvedValue({
      data: [{ number: 2, title: "Görev B", html_url: "u2" }],
    });

    await issueHazirla(config, { repoName: "r", title: "Görev B", body: "b" });

    expect(octokitMock.issues.listForRepo.mock.calls[0][0].state).toBe("all");
    expect(octokitMock.issues.create).not.toHaveBeenCalled();
  });

  it("oluşturma hatası fırlatılmaz", async () => {
    octokitMock.issues.listForRepo.mockResolvedValue({ data: [] });
    octokitMock.issues.create.mockRejectedValue(httpHata(429));

    const r = await issueHazirla(config, { repoName: "r", title: "G", body: "b" });
    expect(r).toEqual({ ok: false, neden: "oran-siniri" });
  });
});
