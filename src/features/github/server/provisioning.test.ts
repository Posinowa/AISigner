import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  requireAuthMock,
  prismaMock,
  genIssuesMock,
  isGitHubConfiguredMock,
  createRepoMock,
  createMilestoneMock,
  createIssueMock,
  closeIssueMock,
  closeMilestoneMock,
  ensureIssueOpenMock,
  ensureMilestoneOpenMock,
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
  closeIssueMock: vi.fn(),
  closeMilestoneMock: vi.fn(),
  ensureIssueOpenMock: vi.fn(),
  ensureMilestoneOpenMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/ai/server/issue-generator", () => ({
  generateStepIssues: (...a: unknown[]) => genIssuesMock(...a),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("./github-api", () => ({
  isGitHubConfigured: () => isGitHubConfiguredMock(),
  createGitHubRepository: (...a: unknown[]) => createRepoMock(...a),
  createGitHubMilestone: (...a: unknown[]) => createMilestoneMock(...a),
  createGitHubIssue: (...a: unknown[]) => createIssueMock(...a),
  closeGitHubIssue: (...a: unknown[]) => closeIssueMock(...a),
  closeGitHubMilestone: (...a: unknown[]) => closeMilestoneMock(...a),
  ensureGitHubIssueOpen: (...a: unknown[]) => ensureIssueOpenMock(...a),
  ensureGitHubMilestoneOpen: (...a: unknown[]) => ensureMilestoneOpenMock(...a),
}));

import { provisionGitHubWorkspace, toAsciiSlug, shortId } from "./provisioning";

// #179 review: Türkçe isimler slug'da siliniyordu → iki öğrenci aynı repo adına düşüp
// 422 "zaten var" ile ÖTEKİNİN reposunu paylaşabiliyordu.
describe("repo adı slug'ı — ASCII güvenliği ve benzersizlik (#179 review)", () => {
  it("Türkçe harfler SİLİNMEZ, ASCII karşılığına çevrilir", () => {
    expect(toAsciiSlug("Öğrenci")).toBe("ogrenci");
    expect(toAsciiSlug("Şevval Çağla")).toBe("sevval-cagla");
    expect(toAsciiSlug("İyi Günler")).toContain("yi-gunler"); // İ → normalize
  });

  it("tamamen ASCII-dışı isim boş slug üretse de çağıran fallback'ler (regresyon)", () => {
    // Eski davranışta "Öğrenci" → "" idi; artık boş DEĞİL.
    expect(toAsciiSlug("Öğrenci")).not.toBe("");
    // Gerçekten boş kalabilecek girdi (yalnız sembol) → "" döner, fallback çağıranda.
    expect(toAsciiSlug("!!!")).toBe("");
    expect(toAsciiSlug(null)).toBe("");
  });

  it("shortId atama başına deterministik ve ASCII-güvenli sonek üretir", () => {
    expect(shortId("cmsh8k7yr0000q47c672uzk8t")).toBe(shortId("cmsh8k7yr0000q47c672uzk8t"));
    expect(shortId("ap-1")).not.toBe(shortId("ap-2"));
    expect(shortId("ap-1")).toMatch(/^[a-z0-9]+$/);
  });
});

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

  // ── #179 review düzeltmeleri ────────────────────────────────────────────────
  describe("idempotent re-run ve kısmi başarı telafisi (#179 review)", () => {
    /** Gerçek GitHub modu için ortak fixture. */
    function realGitHubFixture(stepIssues: Array<Record<string, unknown>>) {
      admin();
      isGitHubConfiguredMock.mockReturnValue(true);
      createRepoMock.mockResolvedValue({
        repoUrl: "https://github.com/Posinowa/aisigner-ali-proje",
        owner: "Posinowa",
        repo: "aisigner-ali-proje",
        alreadyExisted: false,
      });
      createMilestoneMock.mockResolvedValue({
        milestoneNumber: 7,
        htmlUrl: "https://github.com/Posinowa/aisigner-ali-proje/milestone/7",
        alreadyExisted: false,
      });
      createIssueMock.mockResolvedValue({
        issueNumber: 42,
        htmlUrl: "https://github.com/Posinowa/aisigner-ali-proje/issues/42",
      });
      genIssuesMock.mockResolvedValue([{ title: "Task 1", bodyMarkdown: "body" }]);
      prismaMock.stepIssue.findMany.mockResolvedValue(stepIssues);
      prismaMock.assignedProject.findUnique.mockResolvedValue({
        id: "ap-1",
        studentProfile: { user: { name: "Ali" }, experienceLevel: "BEGINNER" },
        projectTemplate: { title: "Proje" },
        roadmap: { steps: [{ id: "s1", title: "Faz 1", description: "d" }] },
      });
    }

    it("githubIssueUrl zaten kayıtlıysa issue TEKRAR açılmaz (duplicate önlemi)", async () => {
      realGitHubFixture([
        {
          id: "iss-1",
          title: "Task 1",
          stepId: "s1",
          githubIssueUrl: "https://github.com/Posinowa/aisigner-ali-proje/issues/5",
        },
      ]);

      const res = await provisionGitHubWorkspace("ap-1");

      expect(res.success).toBe(true);
      expect(createIssueMock).not.toHaveBeenCalled();
      expect(prismaMock.stepIssue.update).not.toHaveBeenCalled();
    });

    // #218 review [P1]: Önceki halde bu dal PRODUCTION'DA ÖLÜ KODDU.
    // `generateStepIssues` → `storeGeneratedIssues` içinde `stepIssue.deleteMany`
    // çalışıp kayıtlı `githubIssueUrl`'leri siliyordu; sonraki "URL varsa atla"
    // kontrolü hiç true olmuyor, ikinci provision duplicate issue açıyordu.
    // Test mock'u `deleteMany`'yi çalıştırmadığı için yeşil görünüyordu.
    //
    // Artık atlama kararı generate'ten ÖNCE veriliyor; bu testin kanıtı da odur:
    // provision edilmiş adımda AI üretimi HİÇ ÇAĞRILMAZ → silme yolu hiç açılmaz.
    it("provision edilmiş adımda generateStepIssues HİÇ çağrılmaz (silme yolu açılmaz)", async () => {
      realGitHubFixture([
        {
          id: "iss-1",
          title: "Task 1",
          stepId: "s1",
          githubIssueUrl: "https://github.com/Posinowa/aisigner-ali-proje/issues/5",
        },
      ]);

      await provisionGitHubWorkspace("ap-1");

      // AI çağrılmadı → storeGeneratedIssues/deleteMany hiç çalışmadı → URL'ler duruyor.
      expect(genIssuesMock).not.toHaveBeenCalled();
      // Duplicate GitHub issue açılmadı.
      expect(createIssueMock).not.toHaveBeenCalled();
    });

    it("HENÜZ provision edilmemiş adımda AI üretimi çalışır (regresyon değil)", async () => {
      realGitHubFixture([{ id: "iss-1", title: "Task 1", stepId: "s1", githubIssueUrl: null }]);

      await provisionGitHubWorkspace("ap-1");

      expect(genIssuesMock).toHaveBeenCalledOnce();
      expect(createIssueMock).toHaveBeenCalledOnce();
    });

    it("yeniden kullanılan (alreadyExisted) milestone kapalıysa yeniden açılır", async () => {
      realGitHubFixture([{ id: "iss-1", title: "Task 1", stepId: "s1", githubIssueUrl: null }]);
      createMilestoneMock.mockResolvedValue({
        milestoneNumber: 7,
        htmlUrl: "https://github.com/Posinowa/aisigner-ali-proje/milestone/7",
        alreadyExisted: true,
      });
      ensureMilestoneOpenMock.mockResolvedValue(true);

      await provisionGitHubWorkspace("ap-1");

      expect(ensureMilestoneOpenMock).toHaveBeenCalledWith(
        expect.objectContaining({ milestoneNumber: 7, repo: "aisigner-ali-proje" }),
      );
    });

    it("kayıtlı issue KAPALIYSA re-run onu yeniden açar (öğrenci kapalı göreve düşmez)", async () => {
      realGitHubFixture([
        {
          id: "iss-1",
          title: "Task 1",
          stepId: "s1",
          githubIssueUrl: "https://github.com/Posinowa/aisigner-ali-proje/issues/5",
        },
      ]);
      ensureIssueOpenMock.mockResolvedValue(true);

      await provisionGitHubWorkspace("ap-1");

      expect(ensureIssueOpenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: "aisigner-ali-proje",
          issueUrl: "https://github.com/Posinowa/aisigner-ali-proje/issues/5",
        }),
      );
      expect(createIssueMock).not.toHaveBeenCalled(); // yine de duplicate açılmaz
    });

    it("githubIssueUrl yoksa issue açılır (ilk çalıştırma)", async () => {
      realGitHubFixture([{ id: "iss-1", title: "Task 1", stepId: "s1", githubIssueUrl: null }]);

      await provisionGitHubWorkspace("ap-1");

      expect(createIssueMock).toHaveBeenCalledOnce();
    });

    it("PERSIST EDİLMEMİŞ issue kapatılır; PERSIST EDİLEN milestone KAPATILMAZ (telafi sözleşmesi)", async () => {
      realGitHubFixture([{ id: "iss-1", title: "Task 1", stepId: "s1", githubIssueUrl: null }]);
      closeIssueMock.mockResolvedValue(true);
      closeMilestoneMock.mockResolvedValue(true);
      // Milestone URL'i roadmapStep.update ile DB'ye YAZILDI (persist edildi).
      // Issue ise GitHub'da açıldı ama stepIssue.update patladı → persist EDİLMEDİ.
      prismaMock.stepIssue.update.mockRejectedValue(new Error("DB down"));

      await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow("DB down");

      // Öksüz (persist edilmemiş) issue kapatılır.
      expect(closeIssueMock).toHaveBeenCalledWith(
        expect.objectContaining({ issueNumber: 42, repo: "aisigner-ali-proje" }),
      );
      // #179 review: Persist edilmiş milestone KAPATILMAZ — aksi halde öğrenci kapalı
      // bir faza yönlenir ve re-run (URL var → atla) onu diriltmez.
      expect(closeMilestoneMock).not.toHaveBeenCalled();
      expect(prismaMock.assignedProject.update).toHaveBeenCalledWith({
        where: { id: "ap-1" },
        data: { githubStatus: "ERROR" },
      });
    });

    it("issue URL'i persist EDİLDİKTEN sonra hata olursa o issue KAPATILMAZ", async () => {
      realGitHubFixture([{ id: "iss-1", title: "Task 1", stepId: "s1", githubIssueUrl: null }]);
      closeIssueMock.mockResolvedValue(true);
      closeMilestoneMock.mockResolvedValue(true);
      // Issue + URL başarıyla persist edildi; hata SONRAKİ adımda (final update) çıktı.
      prismaMock.stepIssue.update.mockResolvedValue({});
      prismaMock.assignedProject.update
        .mockResolvedValueOnce({}) // PROVISIONING
        .mockRejectedValueOnce(new Error("DB down")) // PROVISIONED yazımı patladı
        .mockResolvedValueOnce({}); // ERROR yazımı

      await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow("DB down");

      // Kalıcı tutarsızlık üretmemek için persist edilmiş kaynaklara DOKUNULMAZ.
      expect(closeIssueMock).not.toHaveBeenCalled();
      expect(closeMilestoneMock).not.toHaveBeenCalled();
    });

    it("aynı şablona atanan İKİ ÖĞRENCİ farklı repo adı alır (çakışma yok)", async () => {
      admin();
      isGitHubConfiguredMock.mockReturnValue(true);
      createRepoMock.mockImplementation((p: { repoName: string }) => ({
        repoUrl: `https://github.com/Posinowa/${p.repoName}`,
        owner: "Posinowa",
        repo: p.repoName,
        alreadyExisted: false,
      }));
      createMilestoneMock.mockResolvedValue({ milestoneNumber: 1, htmlUrl: "u", alreadyExisted: false });
      prismaMock.stepIssue.findMany.mockResolvedValue([]);

      // Aynı ada ve aynı proje şablonuna sahip iki FARKLI atama.
      const student = { user: { name: "Öğrenci" }, experienceLevel: "BEGINNER" };
      const template = { title: "Proje Başlığı" };
      const steps = { steps: [{ id: "s1", title: "Faz 1", description: "d" }] };

      prismaMock.assignedProject.findUnique.mockResolvedValueOnce({
        id: "assignment-aaa111", studentProfile: student, projectTemplate: template, roadmap: steps,
      });
      const first = await provisionGitHubWorkspace("assignment-aaa111");

      prismaMock.assignedProject.findUnique.mockResolvedValueOnce({
        id: "assignment-bbb222", studentProfile: student, projectTemplate: template, roadmap: steps,
      });
      const second = await provisionGitHubWorkspace("assignment-bbb222");

      // Türkçe isim silinmediği için slug boş değil; sonek atamaya özel → adlar farklı.
      expect(first.githubRepoUrl).toContain("ogrenci");
      expect(first.githubRepoUrl).not.toBe(second.githubRepoUrl);
    });

    it("simülasyon modunda telafi çağrılmaz (GitHub'a hiç gidilmedi)", async () => {
      admin();
      isGitHubConfiguredMock.mockReturnValue(false);
      prismaMock.stepIssue.findMany.mockResolvedValue([
        { id: "iss-1", title: "Task 1", stepId: "s1", githubIssueUrl: null },
      ]);
      prismaMock.stepIssue.update.mockRejectedValue(new Error("DB down"));
      prismaMock.assignedProject.findUnique.mockResolvedValue({
        id: "ap-1",
        studentProfile: { user: { name: "Ali" }, experienceLevel: "BEGINNER" },
        projectTemplate: { title: "Proje" },
        roadmap: { steps: [{ id: "s1", title: "Faz 1", description: "d" }] },
      });

      await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow("DB down");

      expect(closeIssueMock).not.toHaveBeenCalled();
      expect(closeMilestoneMock).not.toHaveBeenCalled();
    });
  });
});
