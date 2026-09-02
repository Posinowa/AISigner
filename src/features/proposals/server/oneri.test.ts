// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #366 — stajyerin kendi proje önerisi.
 *
 * Kilitlenen kurallar:
 *   1. **DEVRET onayı, devir TAMAMLANMADAN geçmez.** Transferi biz
 *      başlatamıyoruz; yalnızca gerçekleştiğini tespit edebiliyoruz. Tespit
 *      etmeden onaylamak, var olmayan bir depoyu bağlamak olurdu.
 *   2. **Dış depoya bağlı atama `LINKED`** işaretlenir — provisioning bu
 *      atamaya dokunmaz, yoksa BAŞKASININ deposuna issue açardı.
 *   3. Red gerekçesi zorunlu; bekleyen öneri tekilliği kısıtla korunur.
 *   4. Onay yarışında oluşturulan atama YETİM KALMAZ.
 */

const { prismaMock, configMock, octokitMock } = vi.hoisted(() => ({
  prismaMock: {
    studentProfile: { findUnique: vi.fn() },
    projectProposal: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    projectTemplate: { create: vi.fn() },
    assignedProject: { create: vi.fn(), delete: vi.fn() },
  },
  configMock: vi.fn(),
  octokitMock: { repos: { get: vi.fn() } },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/features/github/server/client", () => ({
  readGitHubConfig: configMock,
  getOctokit: () => octokitMock,
}));

import {
  oneriOlustur,
  oneriyiKararaBagla,
  devirTamamlandiMi,
  repoAyristir,
  DIS_DEPO_DURUMU,
} from "./oneri";

const oneri = (ek: Record<string, unknown> = {}) => ({
  id: "p1",
  status: "PENDING",
  title: "Not Defteri",
  description: "d",
  technologies: ["node"],
  kaynak: "BIZIM",
  repoUrl: null,
  studentProfile: { id: "sp1", userId: "u1" },
  ...ek,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
  prismaMock.projectProposal.create.mockResolvedValue({ id: "p1" });
  prismaMock.projectProposal.findUnique.mockResolvedValue(oneri());
  prismaMock.projectProposal.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.projectTemplate.create.mockResolvedValue({ id: "pt1" });
  prismaMock.assignedProject.create.mockResolvedValue({ id: "ap1" });
  prismaMock.assignedProject.delete.mockResolvedValue({});
  configMock.mockReturnValue({ token: "t", owner: "Posinowa" });
});

describe("repoAyristir", () => {
  it.each([
    ["https://github.com/ali/proje", { owner: "ali", repo: "proje" }],
    ["https://github.com/ali/proje.git", { owner: "ali", repo: "proje" }],
    ["https://github.com/ali/proje/", { owner: "ali", repo: "proje" }],
  ])("%s", (url, beklenen) => {
    expect(repoAyristir(url)).toEqual(beklenen);
  });

  it.each(["https://gitlab.com/a/b", "ali/proje", "https://github.com/ali", ""])(
    "%s -> null",
    (url) => {
      expect(repoAyristir(url)).toBeNull();
    },
  );
});

describe("oneriOlustur", () => {
  const temel = {
    studentUserId: "u1",
    title: "Not Defteri",
    description: "d",
    goals: "g",
    technologies: ["node"],
  };

  it("BIZIM kaynağında depo istemez", async () => {
    expect((await oneriOlustur({ ...temel, kaynak: "BIZIM" })).ok).toBe(true);
    // Depo verilse bile BIZIM'de saklanmaz.
    const veri = prismaMock.projectProposal.create.mock.calls[0][0].data;
    expect(veri.repoUrl).toBeNull();
    expect(veri.pendingKey).toBe("sp1");
  });

  it.each(["BAGLA", "DEVRET"] as const)("%s kaynağı DEPO ZORUNLU", async (kaynak) => {
    expect(await oneriOlustur({ ...temel, kaynak })).toEqual({
      ok: false,
      neden: "repo-gerekli",
    });
    expect(prismaMock.projectProposal.create).not.toHaveBeenCalled();
  });

  it("geçersiz depo adresi reddedilir", async () => {
    expect(
      await oneriOlustur({ ...temel, kaynak: "BAGLA", repoUrl: "https://gitlab.com/a/b" }),
    ).toEqual({ ok: false, neden: "repo-gerekli" });
  });

  it("profili olmayan stajyer öneremez", async () => {
    prismaMock.studentProfile.findUnique.mockResolvedValue(null);
    expect(await oneriOlustur({ ...temel, kaynak: "BIZIM" })).toEqual({
      ok: false,
      neden: "profil-yok",
    });
  });

  it("ikinci bekleyen öneri açılamaz (benzersizlik ihlali)", async () => {
    prismaMock.projectProposal.create.mockRejectedValue(new Error("Unique constraint failed"));
    expect(await oneriOlustur({ ...temel, kaynak: "BIZIM" })).toEqual({
      ok: false,
      neden: "zaten-bekliyor",
    });
  });
});

describe("devirTamamlandiMi", () => {
  it("depo ORG altında görünüyorsa tamam", async () => {
    octokitMock.repos.get.mockResolvedValue({ data: { html_url: "https://github.com/Posinowa/proje" } });

    const s = await devirTamamlandiMi("https://github.com/ali/proje");

    expect(s.tamam).toBe(true);
    expect(s.yeniUrl).toBe("https://github.com/Posinowa/proje");
    // Org altında, stajyerin hesabında DEĞİL.
    expect(octokitMock.repos.get).toHaveBeenCalledWith({ owner: "Posinowa", repo: "proje" });
  });

  it("404'te 'henüz devredilmedi' der, patlamaz", async () => {
    octokitMock.repos.get.mockRejectedValue({ status: 404 });
    expect(await devirTamamlandiMi("https://github.com/ali/proje")).toEqual({ tamam: false });
  });

  it("GitHub yapılandırılmamışsa 'tamam' DEMEZ", async () => {
    // Aksi halde kurulmamış bir depoyu bağlardık.
    configMock.mockReturnValue(null);
    expect(await devirTamamlandiMi("https://github.com/ali/proje")).toEqual({ tamam: false });
  });
});

describe("oneriyiKararaBagla — red", () => {
  it("gerekçesiz REDDEDİLEMEZ", async () => {
    expect(await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: false })).toEqual({
      ok: false,
      neden: "gerekce-gerekli",
    });
    expect(prismaMock.projectProposal.updateMany).not.toHaveBeenCalled();
  });

  it("gerekçeli red atama OLUŞTURMAZ", async () => {
    const s = await oneriyiKararaBagla({
      proposalId: "p1",
      adminUserId: "a1",
      onay: false,
      adminNote: "Kapsam çok geniş.",
    });

    expect(s.ok).toBe(true);
    expect(prismaMock.assignedProject.create).not.toHaveBeenCalled();
  });

  it("zaten karara bağlanmış öneri tekrar işlenmez", async () => {
    prismaMock.projectProposal.findUnique.mockResolvedValue(oneri({ status: "APPROVED" }));

    expect(
      await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: true }),
    ).toEqual({ ok: false, neden: "zaten-karara-baglanmis" });
  });
});

describe("oneriyiKararaBagla — onay", () => {
  it("BIZIM: repo yok, kurulum bekleyen atama oluşur", async () => {
    const s = await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: true });

    expect(s).toMatchObject({ ok: true, assignedProjectId: "ap1", kaynak: "BIZIM" });
    const veri = prismaMock.assignedProject.create.mock.calls[0][0].data;
    expect(veri.githubRepoUrl).toBeNull();
    expect(veri.githubStatus).toBe("NOT_PROVISIONED");
  });

  it("BAGLA: depo bağlanır ve atama LINKED işaretlenir", async () => {
    // LINKED olmasaydı provisioning stajyerin deposuna issue açardı.
    prismaMock.projectProposal.findUnique.mockResolvedValue(
      oneri({ kaynak: "BAGLA", repoUrl: "https://github.com/ali/proje" }),
    );

    const s = await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: true });

    expect(s.ok).toBe(true);
    const veri = prismaMock.assignedProject.create.mock.calls[0][0].data;
    expect(veri.githubRepoUrl).toBe("https://github.com/ali/proje");
    expect(veri.githubStatus).toBe(DIS_DEPO_DURUMU);
  });

  it("DEVRET: devir TAMAMLANMAMIŞSA onaylanmaz", async () => {
    // Transferi biz başlatamıyoruz; tespit etmeden onaylamak var olmayan bir
    // depoyu bağlamak olurdu.
    prismaMock.projectProposal.findUnique.mockResolvedValue(
      oneri({ kaynak: "DEVRET", repoUrl: "https://github.com/ali/proje" }),
    );
    octokitMock.repos.get.mockRejectedValue({ status: 404 });

    expect(
      await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: true }),
    ).toEqual({ ok: false, neden: "devir-tamamlanmamis" });
    expect(prismaMock.assignedProject.create).not.toHaveBeenCalled();
  });

  it("DEVRET: devir tamamlanmışsa ORG URL'i bağlanır", async () => {
    prismaMock.projectProposal.findUnique.mockResolvedValue(
      oneri({ kaynak: "DEVRET", repoUrl: "https://github.com/ali/proje" }),
    );
    octokitMock.repos.get.mockResolvedValue({
      data: { html_url: "https://github.com/Posinowa/proje" },
    });

    const s = await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: true });

    expect(s.ok).toBe(true);
    const veri = prismaMock.assignedProject.create.mock.calls[0][0].data;
    // Stajyerin eski adresi DEĞİL, org altındaki yeni adres.
    expect(veri.githubRepoUrl).toBe("https://github.com/Posinowa/proje");
    expect(veri.githubStatus).toBe(DIS_DEPO_DURUMU);
  });

  it("admin stajyerin tercihini GEÇERSİZ KILABİLİR", async () => {
    // Stajyer BAGLA istedi, admin "repoyu biz açalım" dedi.
    prismaMock.projectProposal.findUnique.mockResolvedValue(
      oneri({ kaynak: "BAGLA", repoUrl: "https://github.com/ali/proje" }),
    );

    const s = await oneriyiKararaBagla({
      proposalId: "p1",
      adminUserId: "a1",
      onay: true,
      kaynak: "BIZIM",
    });

    expect(s).toMatchObject({ kaynak: "BIZIM" });
    expect(prismaMock.assignedProject.create.mock.calls[0][0].data.githubStatus).toBe(
      "NOT_PROVISIONED",
    );
  });

  it("şablon ORTAK HAVUZA girmez", async () => {
    await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: true });

    expect(prismaMock.projectTemplate.create.mock.calls[0][0].data.fromProposal).toBe(true);
  });

  it("başlık çakışırsa EK ile yeniden denenir", async () => {
    prismaMock.projectTemplate.create
      .mockRejectedValueOnce(new Error("Unique constraint failed"))
      .mockResolvedValueOnce({ id: "pt1" });

    const s = await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: true });

    expect(s.ok).toBe(true);
    expect(prismaMock.projectTemplate.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.projectTemplate.create.mock.calls[1][0].data.title).not.toBe("Not Defteri");
  });

  it("yarışta oluşturulan atama YETİM KALMAZ", async () => {
    // Başka bir admin araya girip öneriyi karara bağladıysa updateMany 0 döner.
    prismaMock.projectProposal.updateMany.mockResolvedValue({ count: 0 });

    const s = await oneriyiKararaBagla({ proposalId: "p1", adminUserId: "a1", onay: true });

    expect(s).toEqual({ ok: false, neden: "zaten-karara-baglanmis" });
    expect(prismaMock.assignedProject.delete).toHaveBeenCalledWith({ where: { id: "ap1" } });
  });
});
