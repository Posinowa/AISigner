// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

const { prismaMock, loggerMock, metricsMock } = vi.hoisted(() => ({
  prismaMock: {
    stepIssue: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    roadmapStep: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    stepStatusHistory: {
      create: vi.fn(),
    },
    assignedProject: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    processedWebhook: {
      create: vi.fn(),
    },
    pullRequestReview: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    teamMentor: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    projectTemplate: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callbacks: unknown) => {
      if (Array.isArray(callbacks)) {
        return Promise.all(callbacks);
      }
      if (typeof callbacks === "function") {
        return (callbacks as (tx: unknown) => unknown)(prismaMock);
      }
      return Promise.resolve([]);
    }),
  },
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  metricsMock: {
    incrementCounter: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/metrics", () => ({ incrementCounter: metricsMock.incrementCounter }));

// Modules under test
import {
  ogrencisiMi,
  mentoruMu,
  erisebilirMi,
  atamaninOgrenciIdleri,
  atamaninProfilIdleri,
  takimAtamasiMi,
  enDusukSeviye,
  type SahiplikliAtama,
} from "@/features/teams/server/sahiplik";

import {
  hataNedeni,
  hataMesaji,
} from "./client";

import {
  denenebilirMi,
  beklemeSuresiMs,
  yenidenDene,
  MAKS_BEKLEME_MS,
} from "./retry";

import {
  webhookImzasiniDogrula,
  webhookSirriVarMi,
} from "./webhook-imza";

import { issueKapandiginiIsle } from "./webhook-isle";
import { adimDurumunuDegistir } from "@/features/roadmap/server/step-status";
import { uyeEkle, takimaProjeAta, AZAMI_UYE } from "@/features/teams/server/takim";

describe("1. Takım Projelerinde Bireysel vs Takım Sahipliği", () => {
  const bireyselAtama = (
    userId = "student-1",
    mentorIds: string[] = ["mentor-1"]
  ): SahiplikliAtama => ({
    studentProfile: {
      id: "sp-1",
      userId,
      mentorAssignments: mentorIds.map((m) => ({ mentorId: m })),
    },
    team: null,
  });

  const takimAtamasi = (
    activeMembers: Array<{ userId: string; profileId: string; role?: string }>,
    teamMentorIds: string[] = ["mentor-team-1"]
  ): SahiplikliAtama => ({
    studentProfile: null,
    team: {
      id: "team-1",
      name: "Alpha Takımı",
      members: activeMembers.map((m) => ({
        role: m.role || "developer",
        studentProfile: { id: m.profileId, userId: m.userId },
      })),
      mentors: teamMentorIds.map((id) => ({ mentorId: id })),
    },
  });

  describe("Sahiplik ve Üyelik Kontrolleri", () => {
    it("bireysel atamada tek bir öğrenci sahibi olarak belirlenir", () => {
      const atama = bireyselAtama("stu-123", ["men-1"]);
      expect(takimAtamasiMi(atama)).toBe(false);
      expect(atamaninOgrenciIdleri(atama)).toEqual(["stu-123"]);
      expect(atamaninProfilIdleri(atama)).toEqual(["sp-1"]);
      expect(ogrencisiMi(atama, "stu-123")).toBe(true);
      expect(ogrencisiMi(atama, "stu-456")).toBe(false);
    });

    it("takım atamasında tüm aktif üyeler öğrenci olarak tanınır", () => {
      const atama = takimAtamasi([
        { userId: "stu-1", profileId: "sp-1" },
        { userId: "stu-2", profileId: "sp-2" },
      ]);
      expect(takimAtamasiMi(atama)).toBe(true);
      expect(atamaninOgrenciIdleri(atama)).toEqual(["stu-1", "stu-2"]);
      expect(atamaninProfilIdleri(atama)).toEqual(["sp-1", "sp-2"]);
      expect(ogrencisiMi(atama, "stu-1")).toBe(true);
      expect(ogrencisiMi(atama, "stu-2")).toBe(true);
      expect(ogrencisiMi(atama, "stu-3")).toBe(false);
    });

    it("ayrılmış üye (leftAt: null olmayan) sorgu sonucu dahil edilmediğinde sahiplik hakkını kaybeder", () => {
      // Sahiplik sorgusu ATAMA_SAHIPLIK_SELECT where: { leftAt: null } filtresi uygular.
      // Dolayısıyla ayrılmış üye team.members listesinde gelmez.
      const atama = takimAtamasi([
        { userId: "stu-active", profileId: "sp-active" },
        // stu-left ayrılmış ve burada yok
      ]);
      expect(ogrencisiMi(atama, "stu-active")).toBe(true);
      expect(ogrencisiMi(atama, "stu-left")).toBe(false);
      expect(erisebilirMi(atama, "stu-left")).toBe(false);
    });

    it("öğrenci ya da mentör erisebilirMi ile içeri alınır, yabancılar engellenir", () => {
      const atama = takimAtamasi(
        [{ userId: "stu-1", profileId: "sp-1" }],
        ["mentor-a", "mentor-b"]
      );
      expect(erisebilirMi(atama, "stu-1")).toBe(true);
      expect(erisebilirMi(atama, "mentor-a")).toBe(true);
      expect(erisebilirMi(atama, "mentor-b")).toBe(true);
      expect(erisebilirMi(atama, "mentor-c")).toBe(false);
      expect(erisebilirMi(atama, "foreign-user")).toBe(false);
    });

    it("sahiplik boş veya geçersiz atamada kimseye yetki tanımaz", () => {
      const sahipsizAtama: SahiplikliAtama = { studentProfile: null, team: null };
      expect(takimAtamasiMi(sahipsizAtama)).toBe(false);
      expect(ogrencisiMi(sahipsizAtama, "stu-1")).toBe(false);
      expect(mentoruMu(sahipsizAtama, "men-1")).toBe(false);
      expect(erisebilirMi(sahipsizAtama, "stu-1")).toBe(false);
    });

    it("kod-dokümantasyon açığı: takım atamasında üyenin kişisel mentörü mentoruMu tarafından yetkilendirilmez", () => {
      // sahiplik.ts docstring: "Takım atamasında üyelerin kişisel mentörleri de yetkili sayılıyor"
      // Kod uygulaması: takım atamasında studentProfile null olduğundan isAssignedMentor çağrılmaz!
      // Yalnızca team.mentors kontrol edilir.
      const atama = takimAtamasi(
        [{ userId: "stu-1", profileId: "sp-1" }],
        ["team-mentor-1"]
      );
      const studentPersonalMentor = "personal-mentor-1";
      // Gerçek kod davranışı dokümantasyondaki iddiayı karşılamıyor:
      expect(mentoruMu(atama, studentPersonalMentor)).toBe(false);
    });
  });

  describe("Takım Seviyesi Sentezi", () => {
    it("enDusukSeviye en kırılgan üyeyi korumak için en düşük seviyeyi seçer", () => {
      expect(enDusukSeviye(["ADVANCED", "INTERMEDIATE", "BEGINNER"])).toBe("BEGINNER");
      expect(enDusukSeviye(["ADVANCED", "INTERMEDIATE"])).toBe("INTERMEDIATE");
      expect(enDusukSeviye(["ADVANCED"])).toBe("ADVANCED");
      expect(enDusukSeviye([])).toBe("BEGINNER");
    });
  });

  describe("Takım Yaşam Döngüsü Sınır Durumları", () => {
    it("takım üye sayısı AZAMI_UYE sınırına ulaştığında yeni üye eklenemez", async () => {
      prismaMock.team.findUnique.mockResolvedValueOnce({
        id: "team-full",
        members: Array.from({ length: AZAMI_UYE }, (_, i) => ({ id: `m-${i}` })),
      });

      const res = await uyeEkle({
        teamId: "team-full",
        studentUserId: "new-user",
        role: "frontend",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.neden).toBe("takim-dolu");
      }
    });

    it("takım üye sayısı ASGARI_UYE (2) altındayken proje atanamaz", async () => {
      prismaMock.team.findUnique.mockResolvedValueOnce({
        id: "team-single",
        members: [{ id: "only-one-member" }],
      });

      const res = await takimaProjeAta({
        teamId: "team-single",
        projectTemplateId: "template-1",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.neden).toBe("yetersiz-uye");
      }
    });
  });
});

describe("2. GitHub API Token ve Rate Limit Senaryoları", () => {
  it("HTTP 429 yanıtı oran sınırı olarak algılanır ve yeniden denenebilir", () => {
    const error429 = Object.assign(new Error("Too Many Requests"), { status: 429 });
    expect(hataNedeni(error429)).toBe("oran-siniri");
    expect(denenebilirMi(error429)).toBe(true);
    expect(hataMesaji(hataNedeni(error429))).toContain("oran sınırına takıldı");
  });

  it("HTTP 403 + x-ratelimit-remaining: '0' birincil oran sınırı olarak algılanır", () => {
    const errorQuota = Object.assign(new Error("Rate Limit Exceeded"), {
      status: 403,
      response: { headers: { "x-ratelimit-remaining": "0" } },
    });
    expect(hataNedeni(errorQuota)).toBe("oran-siniri");
    expect(denenebilirMi(errorQuota)).toBe(true);
  });

  it("HTTP 403 + retry-after ikincil oran sınırı retry.ts tarafından denenebilir kabul edilir", () => {
    const errorSecondary = Object.assign(new Error("Secondary Rate Limit"), {
      status: 403,
      response: { headers: { "retry-after": "60", "x-ratelimit-remaining": "4000" } },
    });
    expect(denenebilirMi(errorSecondary)).toBe(true);
    // client.ts hataNedeni kontrolü:
    // DİKKAT: client.ts'te hataNedeni SADECE x-ratelimit-remaining === "0" kontrolü yapıyor!
    // Dolayısıyla ikincil rate limit 403 + retry-after iken x-ratelimit-remaining > 0 ise hataNedeni 'yetki-yok' döner!
    expect(hataNedeni(errorSecondary)).toBe("yetki-yok");
  });

  it("HTTP 401 ve normal 403 yetkisizlik hatasıdır, retry EDİLMEZ", () => {
    const error401 = Object.assign(new Error("Unauthorized"), { status: 401 });
    const error403 = Object.assign(new Error("Forbidden"), { status: 403 });

    expect(hataNedeni(error401)).toBe("yetki-yok");
    expect(hataNedeni(error403)).toBe("yetki-yok");
    expect(denenebilirMi(error401)).toBe(false);
    expect(denenebilirMi(error403)).toBe(false);
  });

  it("HTTP 404 bulunamadı ve HTTP 422 zaten var hataları retry EDİLMEZ", () => {
    const error404 = Object.assign(new Error("Not Found"), { status: 404 });
    const error422 = Object.assign(new Error("Unprocessable Entity"), { status: 422 });

    expect(hataNedeni(error404)).toBe("bulunamadi");
    expect(hataNedeni(error422)).toBe("zaten-var");
    expect(denenebilirMi(error404)).toBe(false);
    expect(denenebilirMi(error422)).toBe(false);
  });
});

describe("3. Geçici Hata Retry Mantığı", () => {
  it("5xx sunucu hataları (500, 502, 503, 504) yeniden denenir", () => {
    for (const status of [500, 502, 503, 504]) {
      const err = Object.assign(new Error(`Server Error ${status}`), { status });
      expect(denenebilirMi(err)).toBe(true);
    }
  });

  it("Retry-After başlığı belirtilen saniyeyi milisaniyeye çevirir ve MAKS_BEKLEME_MS ile sınırlar", () => {
    const errNormal = Object.assign(new Error("wait"), {
      status: 429,
      response: { headers: { "retry-after": "5" } },
    });
    expect(beklemeSuresiMs(errNormal, 1)).toBe(5000);

    const errHuge = Object.assign(new Error("wait long"), {
      status: 429,
      response: { headers: { "retry-after": "300" } },
    });
    expect(beklemeSuresiMs(errHuge, 1)).toBe(MAKS_BEKLEME_MS); // 30,000 ms
  });

  it("Retry-After yoksa üstel geri çekilme (exponential backoff) uygular", () => {
    const err500 = Object.assign(new Error("err"), { status: 500 });
    expect(beklemeSuresiMs(err500, 1)).toBe(1000); // 2^0 * 1000
    expect(beklemeSuresiMs(err500, 2)).toBe(2000); // 2^1 * 1000
    expect(beklemeSuresiMs(err500, 3)).toBe(4000); // 2^2 * 1000
  });

  it("sınır durum: ağ kesintisi hatalarında (status kodu yok) denenebilirMi false döner", () => {
    // TypeError: fetch failed veya ECONNRESET durumunda status yoktur
    const networkError = new TypeError("fetch failed");
    expect(denenebilirMi(networkError)).toBe(false);
  });

  it("yenidenDene fonksiyonu maksimum deneme sayısına ulaşana kadar dener ve sonra fırlatır", async () => {
    const mockWait = vi.fn(async () => {});
    const failingOp = vi.fn().mockRejectedValue(Object.assign(new Error("503"), { status: 503 }));

    await expect(
      yenidenDene(failingOp, { ad: "test-op", maksDeneme: 3, bekle: mockWait })
    ).rejects.toThrow();

    expect(failingOp).toHaveBeenCalledTimes(3);
    expect(mockWait).toHaveBeenCalledTimes(2);
  });
});

describe("4. Webhook Replay Koruması (İdempotens) ve HMAC Doğrulama", () => {
  const secret = "super-secret-webhook-key";

  beforeEach(() => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", secret);
  });

  it("geçerli imza başarıyla doğrulanır", () => {
    const body = JSON.stringify({ action: "closed", issue: { number: 42 } });
    const hmac = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
    const signatureHeader = `sha256=${hmac}`;

    const res = webhookImzasiniDogrula(body, signatureHeader);
    expect(res.gecerli).toBe(true);
  });

  it("değiştirilmiş body veya yanlış secret imza doğrulamasını bozar", () => {
    const body = JSON.stringify({ action: "closed", issue: { number: 42 } });
    const wrongHmac = crypto.createHmac("sha256", "wrong-secret").update(body, "utf8").digest("hex");

    const res = webhookImzasiniDogrula(body, `sha256=${wrongHmac}`);
    expect(res.gecerli).toBe(false);
    if (!res.gecerli) {
      expect(res.neden).toBe("eslesmedi");
    }
  });

  it("eksik imza başlığı veya hatalı format anında reddedilir", () => {
    const body = "{}";
    expect(webhookImzasiniDogrula(body, null)).toEqual({ gecerli: false, neden: "imza-yok" });
    expect(webhookImzasiniDogrula(body, "invalid-format")).toEqual({ gecerli: false, neden: "bicim-hatali" });
  });

  it("GITHUB_WEBHOOK_SECRET tanımlı değilse hiçbir istek doğrulanmaz (güvenlik açığı önleme)", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "");
    expect(webhookSirriVarMi()).toBe(false);
    expect(webhookImzasiniDogrula("{}", "sha256=123")).toEqual({ gecerli: false, neden: "sir-yok" });
  });

  it("farklı uzunluktaki hash timingSafeEqual fırlatmadan güvenle reddedilir", () => {
    const res = webhookImzasiniDogrula("{}", "sha256=short");
    expect(res.gecerli).toBe(false);
    if (!res.gecerli) {
      expect(res.neden).toBe("eslesmedi");
    }
  });
});

describe("5. Race Condition Senaryoları", () => {
  it("aynı stepin iki farklı issue'su eşzamanlı kapandığında durum geçişi senaryosu", async () => {
    // Step #1'e ait iki issue var: Issue #101 ve Issue #102.
    // İki webhook isteği eşzamanlı geliyor.
    const stepId = "step-concurrent-1";

    // İstek A: Issue #101'i kapatıyor
    prismaMock.stepIssue.findFirst.mockResolvedValueOnce({
      id: "issue-101",
      stepId,
      status: "OPEN",
    });
    prismaMock.stepIssue.update.mockResolvedValue({});
    // İstek A count sorgusu yaparken İstek B henüz commit etmemişse:
    prismaMock.stepIssue.count.mockResolvedValueOnce(1); // 1 açık kaldı

    const resA = await issueKapandiginiIsle({
      action: "closed",
      issue: { html_url: "https://github.com/org/repo/issues/101" },
    });

    expect(resA.islendi).toBe(true);
    expect(resA.aciklama).toContain("1 açık issue kaldı");

    // İstek B: Issue #102'yi kapatıyor
    prismaMock.stepIssue.findFirst.mockResolvedValueOnce({
      id: "issue-102",
      stepId,
      status: "OPEN",
    });
    // İstek B count sorgusu yaparken ikisi de kapandı:
    prismaMock.stepIssue.count.mockResolvedValueOnce(0); // 0 açık kaldı
    prismaMock.roadmapStep.findUnique.mockResolvedValueOnce({ status: "IN_PROGRESS" });

    const resB = await issueKapandiginiIsle({
      action: "closed",
      issue: { html_url: "https://github.com/org/repo/issues/102" },
    });

    expect(resB.islendi).toBe(true);
    expect(resB.aciklama).toBe("adım COMPLETED yapıldı");
  });

  it("adım zaten COMPLETED iken gecikmiş bir webhook geldiğinde mükerrer geçiş yapılmaz", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValueOnce({
      id: "issue-late",
      stepId: "step-1",
      status: "OPEN",
    });
    prismaMock.stepIssue.count.mockResolvedValueOnce(0);
    // Adım zaten COMPLETED olarak bulunuyor:
    prismaMock.roadmapStep.findUnique.mockResolvedValueOnce({ status: "COMPLETED" });

    const res = await issueKapandiginiIsle({
      action: "closed",
      issue: { html_url: "https://github.com/org/repo/issues/late" },
    });

    expect(res.islendi).toBe(true);
    expect(res.aciklama).toBe("adım zaten tamamlanmış");
  });
});

describe("6. StepIssue Durum Senkronizasyonu", () => {
  it("eşleşen StepIssue bulunamadığında sessizce 200 döner (hata üretmez)", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValueOnce(null);

    const res = await issueKapandiginiIsle({
      action: "closed",
      issue: { html_url: "https://github.com/org/repo/issues/untracked" },
    });

    expect(res.islendi).toBe(false);
    expect(res.aciklama).toBe("eşleşen StepIssue yok");
  });

  it("PR merge edildiğinde pull_request.html_url doğru yakalanır ve işlenir", async () => {
    const prUrl = "https://github.com/org/repo/pull/55";
    prismaMock.stepIssue.findFirst.mockResolvedValueOnce({
      id: "si-pr-55",
      stepId: "step-pr",
      status: "OPEN",
    });
    prismaMock.stepIssue.count.mockResolvedValueOnce(0);
    prismaMock.roadmapStep.findUnique.mockResolvedValueOnce({ status: "IN_PROGRESS" });

    const res = await issueKapandiginiIsle({
      action: "closed",
      pull_request: { html_url: prUrl, merged: true },
    });

    expect(prismaMock.stepIssue.findFirst).toHaveBeenCalledWith({
      where: { githubIssueUrl: prUrl },
      select: { id: true, stepId: true, status: true },
    });
    expect(res.islendi).toBe(true);
    expect(res.aciklama).toBe("adım COMPLETED yapıldı");
  });

  it("adimDurumunuDegistir çağrısı hem adımı günceller hem stepStatusHistory oluşturur", async () => {
    prismaMock.roadmapStep.update.mockResolvedValueOnce({ id: "step-1", status: "COMPLETED" });
    prismaMock.stepStatusHistory.create.mockResolvedValueOnce({ id: "hist-1" });

    await adimDurumunuDegistir({
      stepId: "step-1",
      yeniDurum: "COMPLETED",
      oncekiDurum: "IN_PROGRESS",
      degistirenId: null,
    });

    expect(prismaMock.roadmapStep.update).toHaveBeenCalledWith({
      where: { id: "step-1" },
      data: { status: "COMPLETED" },
    });
    expect(prismaMock.stepStatusHistory.create).toHaveBeenCalledWith({
      data: {
        stepId: "step-1",
        fromStatus: "IN_PROGRESS",
        toStatus: "COMPLETED",
        // #379: Geçişin gerekçesi. Yalnız revizyon isteğinde dolduruluyor;
        // webhook/öğrenci geçişlerinde null.
        note: null,
        changedById: null,
      },
    });
  });
});
