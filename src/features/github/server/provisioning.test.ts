import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * #178 / #257 — çalışma alanı kurulumu ve güncellenmesi.
 *
 * İki yol var: `GITHUB_TOKEN` yoksa simülasyon (GitHub'a gidilmez), varsa
 * gerçek API. En kritik davranışlar:
 * - güncelleme var olanları ATLAR, repo kopya issue'larla dolmaz
 * - güncelleme başarısız olursa PROVISIONED durumu KAYBEDİLMEZ
 */

const {
  requireAuthMock,
  prismaMock,
  genIssuesMock,
  configMock,
  repoMock,
  milestoneMock,
  issueMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    assignedProject: { findUnique: vi.fn(), update: vi.fn() },
    roadmapStep: { update: vi.fn() },
    stepIssue: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  },
  genIssuesMock: vi.fn(),
  configMock: vi.fn(),
  repoMock: vi.fn(),
  milestoneMock: vi.fn(),
  issueMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/ai/server/issue-generator", () => ({
  generateStepIssues: (...a: unknown[]) => genIssuesMock(...a),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("./client", () => ({
  readGitHubConfig: () => configMock(),
  hataMesaji: (neden: string) => `hata:${neden}`,
}));
vi.mock("./repo", () => ({
  repoAdiUret: (p: string[]) => p.join("-").toLowerCase(),
  repoyuHazirla: (...a: unknown[]) => repoMock(...a),
  milestoneHazirla: (...a: unknown[]) => milestoneMock(...a),
  issueHazirla: (...a: unknown[]) => issueMock(...a),
}));

import { provisionGitHubWorkspace, updateGitHubWorkspace } from "./provisioning";

function admin() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "a", role: "ADMIN" } },
  });
}

function atama(over: Record<string, unknown> = {}) {
  return {
    id: "ap-1",
    githubStatus: "NOT_PROVISIONED",
    githubRepoUrl: null,
    studentProfile: { user: { name: "Ali" }, experienceLevel: "BEGINNER" },
    projectTemplate: { title: "Proje" },
    roadmap: { steps: [{ id: "s1", title: "Faz 1", description: "d" }] },
    ...over,
  };
}

/** Gerçek yolu açar: token var gibi davran. */
function tokenVar() {
  configMock.mockReturnValue({ token: "t", owner: "Posinowa" });
}
function tokenYok() {
  configMock.mockReturnValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  genIssuesMock.mockResolvedValue([]);
  prismaMock.stepIssue.findMany.mockResolvedValue([]);
  prismaMock.stepIssue.count.mockResolvedValue(0);
  prismaMock.assignedProject.update.mockResolvedValue({});
  prismaMock.roadmapStep.update.mockResolvedValue({});
  prismaMock.assignedProject.findUnique.mockResolvedValue(atama());
  tokenYok();

  repoMock.mockResolvedValue({
    ok: true,
    olusturuldu: true,
    veri: { name: "r", htmlUrl: "https://github.com/Posinowa/r" },
  });
  milestoneMock.mockResolvedValue({
    ok: true,
    olusturuldu: true,
    veri: { number: 1, title: "Faz 1" },
  });
  issueMock.mockResolvedValue({
    ok: true,
    olusturuldu: true,
    veri: {
      number: 1,
      htmlUrl: "https://github.com/Posinowa/r/issues/1",
      title: "G",
    },
  });
});

describe("provisionGitHubWorkspace — koruma (#178)", () => {
  it("yetkisizse hata fırlatır, DB'ye gidilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });
    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow();
    expect(prismaMock.assignedProject.findUnique).not.toHaveBeenCalled();
  });

  it("atama yoksa hata fırlatır", async () => {
    admin();
    prismaMock.assignedProject.findUnique.mockResolvedValue(null);
    await expect(provisionGitHubWorkspace("yok")).rejects.toThrow(/bulunamadı/i);
  });

  it("yol haritası yoksa hata fırlatır", async () => {
    admin();
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({ roadmap: { steps: [] } }),
    );
    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow(/Roadmap/i);
  });
});

describe("simülasyon yolu — token yok (#257)", () => {
  beforeEach(admin);

  it("simulated=true döner ve mesaj simülasyon olduğunu belirtir", async () => {
    const res = await provisionGitHubWorkspace("ap-1");

    expect(res.simulated).toBe(true);
    expect(res.success).toBe(true);
    expect(res.message.toLowerCase()).toContain("simülasyon");
  });

  it("GERÇEK GitHub'a hiç gidilmez", async () => {
    await provisionGitHubWorkspace("ap-1");

    expect(repoMock, "token yokken repo açılmamalı").not.toHaveBeenCalled();
    expect(milestoneMock).not.toHaveBeenCalled();
    expect(issueMock).not.toHaveBeenCalled();
  });

  it("AI issue içerikleri yine de üretilir", async () => {
    // İçerikler gerçek ve DB'de saklanıyor; yalnızca GitHub'a gönderim simüle.
    await provisionGitHubWorkspace("ap-1");
    expect(genIssuesMock).toHaveBeenCalled();
  });
});

describe("gerçek yol — token var (#257)", () => {
  beforeEach(() => {
    admin();
    tokenVar();
  });

  it("simulated=false döner", async () => {
    const res = await provisionGitHubWorkspace("ap-1");
    expect(res.simulated).toBe(false);
    expect(res.message.toLowerCase()).not.toContain("simülasyon");
  });

  it("repo, milestone ve issue gerçekten oluşturulur", async () => {
    prismaMock.stepIssue.findMany.mockResolvedValue([
      { id: "i1", title: "Görev", bodyMarkdown: "gövde" },
    ]);

    await provisionGitHubWorkspace("ap-1");

    expect(repoMock).toHaveBeenCalled();
    expect(milestoneMock).toHaveBeenCalled();
    expect(issueMock).toHaveBeenCalled();
  });

  it("issue GitHub'dan dönen GERÇEK url ile kaydedilir", async () => {
    prismaMock.stepIssue.findMany.mockResolvedValue([
      { id: "i1", title: "Görev", bodyMarkdown: "gövde" },
    ]);

    await provisionGitHubWorkspace("ap-1");

    expect(prismaMock.stepIssue.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { githubIssueUrl: "https://github.com/Posinowa/r/issues/1" },
    });
  });

  it("issue milestone'a bağlanır", async () => {
    prismaMock.stepIssue.findMany.mockResolvedValue([
      { id: "i1", title: "Görev", bodyMarkdown: "gövde" },
    ]);

    await provisionGitHubWorkspace("ap-1");

    expect(issueMock.mock.calls[0][1].milestoneNumber).toBe(1);
  });

  it("repo açılamazsa hata yukarı taşınır ve durum ERROR olur", async () => {
    repoMock.mockResolvedValue({ ok: false, neden: "yetki-yok" });

    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow(/yetki-yok/);

    const son = prismaMock.assignedProject.update.mock.calls.at(-1);
    expect(son?.[0].data.githubStatus).toBe("ERROR");
  });
});

describe("güncelleme — idempotenslik (#257)", () => {
  beforeEach(() => {
    admin();
    tokenVar();
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({
        githubStatus: "PROVISIONED",
        githubRepoUrl: "https://github.com/Posinowa/r",
      }),
    );
  });

  it("her şey zaten varsa 0 yeni raporlanır", async () => {
    milestoneMock.mockResolvedValue({
      ok: true,
      olusturuldu: false,
      veri: { number: 1, title: "Faz 1" },
    });

    const res = await updateGitHubWorkspace("ap-1");

    expect(res.createdMilestonesCount).toBe(0);
    expect(res.createdIssuesCount).toBe(0);
    expect(res.message).toContain("zaten güncel");
  });

  it("yalnızca gerçekten oluşturulanlar sayılır", async () => {
    prismaMock.stepIssue.findMany.mockResolvedValue([
      { id: "i1", title: "Eski", bodyMarkdown: "b" },
      { id: "i2", title: "Yeni", bodyMarkdown: "b" },
    ]);
    milestoneMock.mockResolvedValue({
      ok: true,
      olusturuldu: false,
      veri: { number: 1, title: "Faz 1" },
    });
    issueMock
      .mockResolvedValueOnce({
        ok: true,
        olusturuldu: false,
        veri: { number: 1, htmlUrl: "u1", title: "Eski" },
      })
      .mockResolvedValueOnce({
        ok: true,
        olusturuldu: true,
        veri: { number: 2, htmlUrl: "u2", title: "Yeni" },
      });

    const res = await updateGitHubWorkspace("ap-1");

    expect(res.createdIssuesCount, "var olan issue yeni sayılmamalı").toBe(1);
    expect(res.message).toContain("1 yeni issue");
  });

  it("guncelleme bayrağı sonuçta taşınır", async () => {
    expect((await updateGitHubWorkspace("ap-1")).guncelleme).toBe(true);
    expect((await provisionGitHubWorkspace("ap-1")).guncelleme).toBe(false);
  });
});

describe("güncelleme başarısız — PROVISIONED kaybedilmez (#257)", () => {
  beforeEach(() => {
    admin();
    tokenVar();
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({
        githubStatus: "PROVISIONED",
        githubRepoUrl: "https://github.com/Posinowa/r",
      }),
    );
  });

  it("kurulu çalışma alanı ERROR'a DÜŞÜRÜLMEZ", async () => {
    // Repo GitHub'da duruyor; yalnızca güncelleme başarısız oldu. ERROR'a
    // düşürmek geri adım olurdu.
    milestoneMock.mockResolvedValue({ ok: false, neden: "oran-siniri" });

    await expect(updateGitHubWorkspace("ap-1")).rejects.toThrow();

    const son = prismaMock.assignedProject.update.mock.calls.at(-1);
    expect(son?.[0].data.githubStatus).toBe("PROVISIONED");
  });

  it("mevcut repo url'i korunur", async () => {
    milestoneMock.mockResolvedValue({ ok: false, neden: "oran-siniri" });

    await expect(updateGitHubWorkspace("ap-1")).rejects.toThrow();

    const son = prismaMock.assignedProject.update.mock.calls.at(-1);
    expect(son?.[0].data.githubRepoUrl).toBe("https://github.com/Posinowa/r");
  });

  it("henüz kurulmamışsa güncelleme hatası ERROR yapar", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({ githubStatus: "NOT_PROVISIONED" }),
    );
    milestoneMock.mockResolvedValue({ ok: false, neden: "oran-siniri" });

    await expect(updateGitHubWorkspace("ap-1")).rejects.toThrow();

    const son = prismaMock.assignedProject.update.mock.calls.at(-1);
    expect(son?.[0].data.githubStatus).toBe("ERROR");
  });

  it("İLK kurulum başarısızsa ERROR yapar", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(atama());
    repoMock.mockResolvedValue({ ok: false, neden: "yetki-yok" });

    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow();

    const son = prismaMock.assignedProject.update.mock.calls.at(-1);
    expect(son?.[0].data.githubStatus).toBe("ERROR");
  });
});

/**
 * #257 — güncellemede MEVCUT repo adı korunmalı.
 *
 * Repo adı öğrenci adı + proje başlığından türetiliyor. Bu türetme değişirse
 * (Türkçe karakter çevirisi düzeltmesi gibi) güncelleme var olan repoyu
 * bulamayıp YENİSİNİ açar; öğrencinin işi eski repoda öksüz kalır.
 */
describe("güncelleme — mevcut repo adı korunur (#257)", () => {
  beforeEach(() => {
    admin();
    tokenVar();
  });

  it("kayıtlı repo adı yeniden kullanılır, yeni ad TÜRETİLMEZ", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({
        githubStatus: "PROVISIONED",
        githubRepoUrl: "https://github.com/Posinowa/eski-bozuk-ad",
      }),
    );

    await updateGitHubWorkspace("ap-1");

    expect(repoMock.mock.calls[0][1].repoName).toBe("eski-bozuk-ad");
  });

  it("kayıtlı repo yoksa addan türetilir", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(atama());

    await provisionGitHubWorkspace("ap-1");

    expect(repoMock.mock.calls[0][1].repoName).toBe("aisigner-ali-proje-ap-1");
  });

  it("BAŞKA hesabın reposu yeniden kullanılmaz", async () => {
    // Yapılandırılan hesap Posinowa; başka bir hesabın reposunu güncellemek yanlış.
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({
        githubStatus: "PROVISIONED",
        githubRepoUrl: "https://github.com/baska-hesap/bir-repo",
      }),
    );

    await updateGitHubWorkspace("ap-1");

    expect(repoMock.mock.calls[0][1].repoName).toBe("aisigner-ali-proje-ap-1");
  });

  it("bozuk url'den ad çıkarılmaya çalışılmaz", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({ githubStatus: "PROVISIONED", githubRepoUrl: "bu-bir-url-degil" }),
    );

    await updateGitHubWorkspace("ap-1");

    expect(repoMock.mock.calls[0][1].repoName).toBe("aisigner-ali-proje-ap-1");
  });

  it("hesap adı büyük/küçük harf farkı sorun olmaz", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({
        githubStatus: "PROVISIONED",
        githubRepoUrl: "https://github.com/POSINOWA/korunacak-ad",
      }),
    );

    await updateGitHubWorkspace("ap-1");

    expect(repoMock.mock.calls[0][1].repoName).toBe("korunacak-ad");
  });
});

/**
 * #269 — güncelleme, GÖNDERİLMİŞ adımlarda AI'ı hiç çağırmamalı.
 *
 * `storeGeneratedIssues` kayıtları siliyor; AI yeniden çağrılırsa kayıtlı
 * `githubIssueUrl` bağlantıları kaybolur ve yeni üretilen başlıklar farklı
 * olduğunda GitHub'da KOPYA issue açılır. Bu, #257'deki "idempotent
 * güncelleme" iddiasını gerçek API yolunda çürütüyordu.
 */
describe("güncelleme — gönderilmiş adımda AI çağrılmaz (#269)", () => {
  beforeEach(() => {
    admin();
    tokenVar();
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({
        githubStatus: "PROVISIONED",
        githubRepoUrl: "https://github.com/Posinowa/r",
      }),
    );
    milestoneMock.mockResolvedValue({
      ok: true,
      olusturuldu: false,
      veri: { number: 1, title: "Faz 1" },
    });
  });

  it("adımda gönderilmiş issue varsa AI HİÇ çağrılmaz", async () => {
    prismaMock.stepIssue.count.mockResolvedValue(3);

    await updateGitHubWorkspace("ap-1");

    expect(
      genIssuesMock,
      "gönderilmiş adımda AI çağrılırsa bağlantılar silinir",
    ).not.toHaveBeenCalled();
  });

  it("gönderilmiş issue yoksa AI çalışır (regresyon değil)", async () => {
    prismaMock.stepIssue.count.mockResolvedValue(0);

    await updateGitHubWorkspace("ap-1");

    expect(genIssuesMock).toHaveBeenCalled();
  });

  it("kontrol GÖNDERİLMİŞ kayıtlara bakar, hepsine değil", async () => {
    prismaMock.stepIssue.count.mockResolvedValue(0);

    await updateGitHubWorkspace("ap-1");

    expect(prismaMock.stepIssue.count).toHaveBeenCalledWith({
      where: { stepId: "s1", githubIssueUrl: { not: null } },
    });
  });

  it("ilk kurulumda da aynı koruma geçerli", async () => {
    // Yarıda kalmış bir kurulum tekrar denendiğinde de bağlantılar korunmalı.
    prismaMock.assignedProject.findUnique.mockResolvedValue(atama());
    prismaMock.stepIssue.count.mockResolvedValue(2);

    await provisionGitHubWorkspace("ap-1");

    expect(genIssuesMock).not.toHaveBeenCalled();
  });
});

/**
 * #274 — repo adı atamaya özel olmalı.
 *
 * Adı aynı olan iki öğrenci aynı projeye atandığında aynı repo adını
 * üretiyorlardı; repo işlemleri idempotent olduğu için ikincinin issue'ları
 * BİRİNCİNİN reposuna açılırdı.
 */
describe("repo adı çakışması (#274)", () => {
  beforeEach(() => {
    admin();
    tokenVar();
  });

  async function repoAdiniAl(atamaVerisi: Record<string, unknown>) {
    vi.clearAllMocks();
    prismaMock.stepIssue.count.mockResolvedValue(0);
    prismaMock.stepIssue.findMany.mockResolvedValue([]);
    prismaMock.assignedProject.update.mockResolvedValue({});
    prismaMock.roadmapStep.update.mockResolvedValue({});
    repoMock.mockResolvedValue({
      ok: true,
      olusturuldu: true,
      veri: { name: "r", htmlUrl: "https://github.com/Posinowa/r" },
    });
    milestoneMock.mockResolvedValue({
      ok: true,
      olusturuldu: true,
      veri: { number: 1, title: "Faz 1" },
    });
    prismaMock.assignedProject.findUnique.mockResolvedValue(atamaVerisi);

    await provisionGitHubWorkspace(String(atamaVerisi.id));
    return repoMock.mock.calls[0][1].repoName as string;
  }

  it("AYNI adlı iki öğrenci FARKLI repo adı alır", async () => {
    const birinci = await repoAdiniAl(
      atama({ id: "ap-aaaaaaaa", studentProfile: { user: { name: "Ali" }, experienceLevel: "BEGINNER" } }),
    );
    const ikinci = await repoAdiniAl(
      atama({ id: "ap-bbbbbbbb", studentProfile: { user: { name: "Ali" }, experienceLevel: "BEGINNER" } }),
    );

    expect(birinci).not.toBe(ikinci);
  });

  it("adı OLMAYAN iki öğrenci de aynı repoyu paylaşmaz", async () => {
    // "student" fallback'i en kötü durumdu: adsız herkes aynı repoda.
    const birinci = await repoAdiniAl(
      atama({ id: "ap-cccccccc", studentProfile: { user: { name: null }, experienceLevel: "BEGINNER" } }),
    );
    const ikinci = await repoAdiniAl(
      atama({ id: "ap-dddddddd", studentProfile: { user: { name: null }, experienceLevel: "BEGINNER" } }),
    );

    expect(birinci).not.toBe(ikinci);
  });

  it("AYNI atama her zaman AYNI ada çözülür (idempotenslik)", async () => {
    // Deterministik olmazsa her provision yeni repo açardı.
    const veri = atama({ id: "ap-eeeeeeee" });

    expect(await repoAdiniAl(veri)).toBe(await repoAdiniAl(veri));
  });

  it("ad hâlâ okunabilir — öğrenci ve proje adını taşır", async () => {
    const ad = await repoAdiniAl(
      atama({ id: "ap-ffffffff", studentProfile: { user: { name: "Ayse" }, experienceLevel: "BEGINNER" } }),
    );

    expect(ad).toContain("ayse");
    expect(ad).toContain("proje");
  });
});

describe("üretimde simülasyon YASAK (#179)", () => {
  beforeEach(admin);
  afterEach(() => vi.unstubAllEnvs());

  const uretim = () => vi.stubEnv("NODE_ENV", "production");

  it("token YOKKEN üretimde işlem başarısız olur", async () => {
    // Simülasyon DB'ye sahte URL yazıp atamayı PROVISIONED damgalıyordu;
    // admin "oluşturuldu" görüyor, öğrenci 404 veren bağlantıya tıklıyordu.
    uretim();

    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow(/GITHUB_TOKEN/);
  });

  it("üretimde SAHTE veri veritabanına yazılmaz", async () => {
    uretim();

    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow();

    // Adım/issue URL'leri simülasyonda burada güncelleniyordu.
    expect(prismaMock.roadmapStep.update).not.toHaveBeenCalled();
  });

  it("üretimde atama PROVISIONED damgası ALMAZ", async () => {
    uretim();

    await expect(provisionGitHubWorkspace("ap-1")).rejects.toThrow();

    const provisionedYazildi = prismaMock.assignedProject.update.mock.calls.some(
      ([arg]) =>
        (arg as { data?: { githubStatus?: string } })?.data?.githubStatus === "PROVISIONED",
    );
    expect(provisionedYazildi, "üretimde sahte kurulum PROVISIONED sayılmamalı").toBe(false);
  });

  it("GELİŞTİRMEDE simülasyon korunur", async () => {
    // Token'ı olmayan geliştirme ortamında uygulama çalışmayı sürdürmeli.
    vi.stubEnv("NODE_ENV", "development");

    const res = await provisionGitHubWorkspace("ap-1");
    expect(res.simulated).toBe(true);
    expect(res.success).toBe(true);
  });

  it("üretimde token VARSA normal çalışır", async () => {
    uretim();
    tokenVar();

    const res = await provisionGitHubWorkspace("ap-1");
    expect(res.simulated).toBe(false);
  });
});
