// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #327 — AI kod incelemesi orkestrasyonu.
 *
 * Bu testlerin ASIL İŞİ iki şeyi kilitlemek:
 *   1. Gemini'ye giden yolda hangi kapılar var (rıza, tavan, idempotens)
 *   2. Bir yorumun HANGİ durumlarda public bir PR'a YAZILMAYACAĞI
 *
 * İkincisi daha kritik: yanlış yazılan bir yorum geri alınamaz ve herkes görür.
 */

const {
  prismaMock,
  octokitMock,
  rizaMock,
  incelemeUretMock,
  diffAlMock,
  limitMock,
} = vi.hoisted(() => ({
  prismaMock: {
    assignedProject: { findFirst: vi.fn() },
    stepIssue: { findFirst: vi.fn() },
    pullRequestReview: { create: vi.fn(), deleteMany: vi.fn() },
  },
  octokitMock: { issues: { listComments: vi.fn(), createComment: vi.fn() } },
  rizaMock: vi.fn(),
  incelemeUretMock: vi.fn(),
  diffAlMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/metrics", () => ({ incrementCounter: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: (ad: string) => ({
    check: (kimlik: string) => limitMock(ad, kimlik),
  }),
}));
vi.mock("@/features/kvkk/riza", () => ({ guncelRizaVar: rizaMock }));
vi.mock("@/features/ai/server/code-review", () => ({
  kodIncelemesiUret: incelemeUretMock,
  MAKS_BULGU: 6,
}));
vi.mock("./pr-diff", () => ({ prDiffiniAl: diffAlMock }));
vi.mock("./retry", async () => {
  const gercek = await vi.importActual<typeof import("./retry")>("./retry");
  return {
    ...gercek,
    yenidenDene: <T,>(islem: () => Promise<T>, s: { ad: string }) =>
      gercek.yenidenDene(islem, { ...s, bekle: async () => {} }),
  };
});
vi.mock("./client", async () => {
  const gercek = await vi.importActual<typeof import("./client")>("./client");
  return { ...gercek, getOctokit: () => octokitMock };
});

import {
  prAcildiginiIncele,
  incelemeYorumu,
  issueNumarasiCikar,
  BOT_ISARETI,
} from "./pr-inceleme";

const REPO_URL = "https://github.com/test-org/proje";

const olay = (ek: Record<string, unknown> = {}) => ({
  action: "opened",
  repository: {
    html_url: REPO_URL,
    name: "proje",
    owner: { login: "test-org" },
  },
  pull_request: {
    number: 7,
    title: "feat: giriş formu",
    body: "Closes #3",
    draft: false,
    head: { ref: "feature/issue-3-giris" },
    ...ek,
  },
});

const inceleme = {
  ozet: "Giriş formu eklenmiş.",
  bulgular: [
    { dosya: "src/a.ts", onem: "uyari" as const, baslik: "Sabit sır", aciklama: "Anahtar kodda." },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_ORG = "test-org";

  prismaMock.assignedProject.findFirst.mockResolvedValue({
    id: "ap1",
    studentProfile: { id: "sp1", experienceLevel: "BEGINNER", user: { id: "u1" } },
    projectTemplate: { title: "Blog API" },
    roadmap: { id: "rm1" },
  });
  prismaMock.stepIssue.findFirst.mockResolvedValue({
    step: { title: "Kimlik doğrulama", description: "Argon2 ile giriş." },
  });
  prismaMock.pullRequestReview.create.mockResolvedValue({});
  prismaMock.pullRequestReview.deleteMany.mockResolvedValue({ count: 1 });
  rizaMock.mockResolvedValue(true);
  limitMock.mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
  octokitMock.issues.listComments.mockResolvedValue({ data: [] });
  octokitMock.issues.createComment.mockResolvedValue({ data: {} });
  diffAlMock.mockResolvedValue({
    ok: true,
    dosyalar: [{ yol: "src/a.ts", durum: "modified", yama: "@@ -1 +1 @@" }],
    elenenSayisi: 0,
    kirpildi: false,
  });
  incelemeUretMock.mockResolvedValue(inceleme);
});

describe("issueNumarasiCikar", () => {
  it("kapatma anahtar kelimesini önceler", () => {
    // Gövdede hem "Closes #42" hem başka bir #7 varsa doğru olan 42'dir.
    expect(issueNumarasiCikar(["Bkz #7 ve Closes #42"])).toBe(42);
  });

  it("depo kuralındaki dal adından okur", () => {
    expect(issueNumarasiCikar([null, null, "feature/issue-12-baslik"])).toBe(12);
  });

  it("son çare olarak düz #N kullanır", () => {
    expect(issueNumarasiCikar(["ilgili konu #9"])).toBe(9);
  });

  it("hiçbir işaret yoksa null döner", () => {
    expect(issueNumarasiCikar(["açıklama", null, "main"])).toBeNull();
  });
});

describe("incelemeYorumu", () => {
  it("bot işareti ve mentör ibaresi içerir", () => {
    const m = incelemeYorumu(inceleme, false);
    expect(m.startsWith(BOT_ISARETI)).toBe(true);
    expect(m).toContain("mentörünün değerlendirmesi esastır");
  });

  it("uyarıları önerilerin üstüne alır", () => {
    const m = incelemeYorumu(
      {
        ozet: "x",
        bulgular: [
          { dosya: "b.ts", onem: "bilgi", baslik: "B", aciklama: "b" },
          { dosya: "a.ts", onem: "uyari", baslik: "A", aciklama: "a" },
        ],
      },
      false,
    );
    expect(m.indexOf("A")).toBeLessThan(m.indexOf("B"));
  });

  it("bulgu yoksa boş liste yerine olumlu not yazar", () => {
    expect(incelemeYorumu({ ozet: "x", bulgular: [] }, false)).toContain("bulgu yok");
  });

  it("diff kırpıldıysa bunu dürüstçe söyler", () => {
    expect(incelemeYorumu(inceleme, true)).toContain("tamamı incelenmedi");
  });
});

describe("prAcildiginiIncele — yorum yazılan yol", () => {
  it("PR'a tek bir yorum yazar", async () => {
    const s = await prAcildiginiIncele(olay());

    expect(s.islendi).toBe(true);
    expect(octokitMock.issues.createComment).toHaveBeenCalledTimes(1);
    const cagri = octokitMock.issues.createComment.mock.calls[0][0];
    expect(cagri).toMatchObject({ owner: "test-org", repo: "proje", issue_number: 7 });
    expect(cagri.body).toContain(BOT_ISARETI);
  });

  it("adım bağlamını prompt'a geçirir", async () => {
    // #327'nin asıl değeri bu: genel bir araç bu bağlamı bilemez.
    await prAcildiginiIncele(olay());

    expect(incelemeUretMock).toHaveBeenCalledWith(expect.anything(), {
      projeBasligi: "Blog API",
      adimBasligi: "Kimlik doğrulama",
      adimAciklamasi: "Argon2 ile giriş.",
      deneyimSeviyesi: "BEGINNER",
      prBasligi: "feat: giriş formu",
      kirpildi: false,
    });
  });

  it("adım bulunamazsa incelemeyi yine yapar, bağlamı boş geçer", async () => {
    prismaMock.stepIssue.findFirst.mockResolvedValue(null);

    const s = await prAcildiginiIncele(olay());

    expect(s.islendi).toBe(true);
    expect(incelemeUretMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ adimBasligi: null, adimAciklamasi: null }),
    );
  });
});

describe("prAcildiginiIncele — yorum YAZILMAYAN yollar", () => {
  const yazmadi = (s: { islendi: boolean }) => {
    expect(s.islendi).toBe(false);
    expect(octokitMock.issues.createComment).not.toHaveBeenCalled();
  };

  it("KVKK rızası yoksa AI'ya HİÇ gitmez", async () => {
    // En kritik kapı: kod, rıza olmadan yurt dışına çıkamaz.
    rizaMock.mockResolvedValue(false);

    const s = await prAcildiginiIncele(olay());

    yazmadi(s);
    expect(incelemeUretMock).not.toHaveBeenCalled();
    expect(diffAlMock).not.toHaveBeenCalled();
  });

  it("taslak PR'ı incelemez", async () => {
    yazmadi(await prAcildiginiIncele(olay({ draft: true })));
    expect(incelemeUretMock).not.toHaveBeenCalled();
  });

  it("aynı PR'a ikinci kez yorum yazmaz", async () => {
    // Taslak PR "opened" + "ready_for_review" ile iki kez gelir; teslimat
    // kimliği farklı olduğu için ProcessedWebhook bunu elemez.
    octokitMock.issues.listComments.mockResolvedValue({
      data: [{ body: `${BOT_ISARETI}\n### 🤖 AI ön incelemesi` }],
    });

    const s = await prAcildiginiIncele(olay({ draft: false }));

    yazmadi(s);
    expect(incelemeUretMock).not.toHaveBeenCalled();
  });

  it("mevcut yorumlar okunamazsa kopya riskini almaz", async () => {
    octokitMock.issues.listComments.mockRejectedValue({ status: 500 });

    yazmadi(await prAcildiginiIncele(olay()));
    expect(incelemeUretMock).not.toHaveBeenCalled();
  });

  it("öğrenci günlük tavanı dolduysa durur", async () => {
    limitMock.mockImplementation(async (ad: string) =>
      ad === "ai-code-review-ogrenci"
        ? { allowed: false, remaining: 0, retryAfterSeconds: 60 }
        : { allowed: true, remaining: 5, retryAfterSeconds: 0 },
    );

    yazmadi(await prAcildiginiIncele(olay()));
    expect(incelemeUretMock).not.toHaveBeenCalled();
  });

  it("platform günlük tavanı dolduysa durur", async () => {
    limitMock.mockImplementation(async (ad: string) =>
      ad === "ai-code-review-genel"
        ? { allowed: false, remaining: 0, retryAfterSeconds: 60 }
        : { allowed: true, remaining: 5, retryAfterSeconds: 0 },
    );

    yazmadi(await prAcildiginiIncele(olay()));
    expect(incelemeUretMock).not.toHaveBeenCalled();
  });

  it("eşleşen proje ataması yoksa dokunmaz", async () => {
    // Hesapta bizim açmadığımız repolar da var.
    prismaMock.assignedProject.findFirst.mockResolvedValue(null);

    yazmadi(await prAcildiginiIncele(olay()));
    expect(rizaMock).not.toHaveBeenCalled();
  });

  it("repo başka bir hesaptaysa dokunmaz", async () => {
    const yabanci = olay();
    yabanci.repository.owner.login = "baskasi";

    yazmadi(await prAcildiginiIncele(yabanci));
    expect(prismaMock.assignedProject.findFirst).not.toHaveBeenCalled();
  });

  it("GITHUB_TOKEN yoksa sessizce geçer", async () => {
    delete process.env.GITHUB_TOKEN;

    yazmadi(await prAcildiginiIncele(olay()));
  });

  it("AI üretimi başarısızsa MOCK yorum YAZMAZ", async () => {
    // Diğer AI modülleri mock içeriğe düşüyor; burada düşemez — çıktı public.
    incelemeUretMock.mockRejectedValue(new Error("model yok"));

    yazmadi(await prAcildiginiIncele(olay()));
  });

  it("diff alınamazsa AI'yı çağırmaz", async () => {
    diffAlMock.mockResolvedValue({ ok: false, neden: "incelenecek-degisiklik-yok" });

    yazmadi(await prAcildiginiIncele(olay()));
    expect(incelemeUretMock).not.toHaveBeenCalled();
  });

  it("yorum yazılamazsa fırlatmaz — webhook 2xx dönebilmeli", async () => {
    octokitMock.issues.createComment.mockRejectedValue({ status: 403 });

    const s = await prAcildiginiIncele(olay());
    expect(s.islendi).toBe(false);
  });

  it("yorum yazılamazsa idempotens kaydını GERİ ALIR", async () => {
    // Geçici bir GitHub hatası incelemeyi kalıcı olarak engellememeli.
    octokitMock.issues.createComment.mockRejectedValue({ status: 500 });

    await prAcildiginiIncele(olay());

    expect(prismaMock.pullRequestReview.deleteMany).toHaveBeenCalledWith({
      where: { repoUrl: REPO_URL, prNumber: 7 },
    });
  });

  it("başka bir teslimat kaydı zaten atmışsa İKİNCİ YORUM yazmaz", async () => {
    // GitHub'ın yorum listesi gecikmeli olduğu için yukarıdaki tarama bu yarışı
    // kaçırabilir; otoriter koruma bu benzersizlik ihlali.
    prismaMock.pullRequestReview.create.mockRejectedValue(
      new Error("Unique constraint failed"),
    );

    yazmadi(await prAcildiginiIncele(olay()));
  });

  it("olay gövdesi bozuksa fırlatmaz", async () => {
    const s = await prAcildiginiIncele({ action: "opened" });
    expect(s.islendi).toBe(false);
  });
});
