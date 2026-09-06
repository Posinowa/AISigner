// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * #255 — GitHub yapılandırma sözleşmesi.
 *
 * En kritik davranış: token yoksa sistem KIRILMAZ, `null` döner ve çağıran
 * simülasyona düşer. İkincisi: yanlış hesapta gerçek repo açılmasın diye
 * `GITHUB_ORG` boşsa sessizce varsayılana DÜŞÜLMEZ.
 */

const { octokitMock } = vi.hoisted(() => ({
  octokitMock: {
    users: { getByUsername: vi.fn(), getAuthenticated: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));
// #346: `sahipTuruniCoz` modül içindeki `getOctokit`'i kullanıyor; onu
// yakalamak için Octokit YAPICISI mock'lanıyor.
// Her çağrıda AYRI nesne: `getOctokit` önbelleğinin "token değişince yeni
// istemci" davranışı test edilebilir kalmalı. Casuslar paylaşılıyor.
// ⚠️ OK FONKSİYONU DEĞİL, NORMAL FONKSİYON (#479). `getOctokit` içeride
// `new Octokit(...)` çağırıyor ve **ok fonksiyonları JavaScript'te `new` ile
// çağrılamaz**. vitest 3 uygulamayı kendi sarmalayıcısına aldığı için hata
// örtülüyordu; vitest 4 ok fonksiyonunun bu özelliğini koruyor ve
// "() => ({ ...octokitMock }) is not a constructor" ile patlıyor.
//
// Yani bu bir vitest 4 kırılması DEĞİL: mock baştan beri yanlıştı, eski
// sürüm sessizce düzeltiyordu. Normal fonksiyon her iki sürümde de çalışır.
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn(function () {
    return { ...octokitMock };
  }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  readGitHubConfig,
  getOctokit,
  resetGitHubClientForTests,
  hataNedeni,
  hataMesaji,
  sahipTuruniCoz,
  VARSAYILAN_ORG,
} from "./client";

const ORJINAL = { ...process.env };

beforeEach(() => {
  resetGitHubClientForTests();
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_ORG;
});

afterEach(() => {
  process.env = { ...ORJINAL };
});

describe("readGitHubConfig — token", () => {
  it("token yoksa null döner (sistem kırılmaz)", () => {
    expect(readGitHubConfig()).toBeNull();
  });

  it.each(["", "   "])("boş token (%s) yapılandırma saymaz", (t) => {
    process.env.GITHUB_TOKEN = t;
    expect(readGitHubConfig()).toBeNull();
  });

  it("token varsa yapılandırma döner", () => {
    process.env.GITHUB_TOKEN = "gizli-token";
    expect(readGitHubConfig()).toEqual({
      token: "gizli-token",
      owner: VARSAYILAN_ORG,
    });
  });

  it("token kırpılır", () => {
    process.env.GITHUB_TOKEN = "  gizli-token  ";
    expect(readGitHubConfig()?.token).toBe("gizli-token");
  });
});

describe("readGitHubConfig — hesap", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "gizli-token";
  });

  it("GITHUB_ORG tanımsızsa varsayılan organizasyon kullanılır", () => {
    expect(readGitHubConfig()?.owner).toBe("Posinowa");
  });

  it("GITHUB_ORG verilirse o kullanılır", () => {
    process.env.GITHUB_ORG = "baska-org";
    expect(readGitHubConfig()?.owner).toBe("baska-org");
  });

  it.each(["", "   "])(
    "GITHUB_ORG tanımlı ama boşsa (%s) varsayılana DÜŞÜLMEZ",
    (org) => {
      // Sessizce varsayılana düşmek yanlış hesapta repo açmaya yol açardı.
      process.env.GITHUB_ORG = org;
      expect(readGitHubConfig()).toBeNull();
    },
  );
});

describe("getOctokit — önbellek", () => {
  it("aynı token için aynı istemciyi döndürür", () => {
    const c = { token: "t1", owner: "o" };
    expect(getOctokit(c)).toBe(getOctokit(c));
  });

  it("token değişince yeni istemci kurulur", () => {
    const ilk = getOctokit({ token: "t1", owner: "o" });
    const ikinci = getOctokit({ token: "t2", owner: "o" });
    expect(ilk).not.toBe(ikinci);
  });
});

describe("hataNedeni", () => {
  it.each([
    [401, "yetki-yok"],
    [403, "yetki-yok"],
    [404, "bulunamadi"],
    [422, "zaten-var"],
    [429, "oran-siniri"],
    [500, "bilinmeyen"],
  ] as const)("HTTP %s → %s", (status, beklenen) => {
    expect(hataNedeni({ status })).toBe(beklenen);
  });

  it("kalan kotası 0 olan 403 oran sınırı sayılır", () => {
    // GitHub oran sınırını da 403 ile bildiriyor; ayrımı başlık veriyor.
    expect(
      hataNedeni({
        status: 403,
        response: { headers: { "x-ratelimit-remaining": "0" } },
      }),
    ).toBe("oran-siniri");
  });

  it("tanınmayan hata bilinmeyen olur", () => {
    expect(hataNedeni(new Error("kopuk baglanti"))).toBe("bilinmeyen");
    expect(hataNedeni(null)).toBe("bilinmeyen");
  });
});

describe("hataMesaji — token sızmaz", () => {
  it.each([
    "yetki-yok",
    "bulunamadi",
    "zaten-var",
    "oran-siniri",
    "bilinmeyen",
  ] as const)("%s için kullanıcıya anlamlı mesaj verilir", (neden) => {
    const m = hataMesaji(neden);
    expect(m.length).toBeGreaterThan(0);
    expect(m).not.toMatch(/token['"]?\s*[:=]/i);
  });

  it("her neden farklı mesaj verir", () => {
    const hepsi = (
      ["yetki-yok", "bulunamadi", "zaten-var", "oran-siniri", "bilinmeyen"] as const
    ).map(hataMesaji);
    expect(new Set(hepsi).size).toBe(hepsi.length);
  });
});

/**
 * #346 — HESAP TÜRÜ TAHMİN EDİLMEZ, SORULUR.
 *
 * `repos.createInOrg` yalnızca organizasyonlara açık. Kişisel hesap desteği
 * eklenirken cazip yol "createInOrg dene, 404 alırsan kişiseldir" idi; bu
 * yanlış yazılmış bir org adını, silinmiş bir org'u ve token'ın göremediği bir
 * org'u da kişisel hesap sanıp DEPOYU BAŞKA YERE AÇARDI.
 */
describe("sahipTuruniCoz (#346)", () => {
  const config = { token: "t", owner: "Posinowa" };
  const httpHata = (status: number) => Object.assign(new Error("gh"), { status });

  beforeEach(() => {
    vi.clearAllMocks();
    resetGitHubClientForTests();
  });

  it("Organization → organizasyon", async () => {
    octokitMock.users.getByUsername.mockResolvedValue({ data: { type: "Organization" } });

    expect(await sahipTuruniCoz(config)).toEqual({ ok: true, tur: "organizasyon" });
    // Org ise kimlik sorgusuna gerek yok.
    expect(octokitMock.users.getAuthenticated).not.toHaveBeenCalled();
  });

  it("token sahibinin KENDİ hesabı → kendi-hesabim", async () => {
    octokitMock.users.getByUsername.mockResolvedValue({ data: { type: "User" } });
    octokitMock.users.getAuthenticated.mockResolvedValue({ data: { login: "Posinowa" } });

    expect(await sahipTuruniCoz(config)).toEqual({ ok: true, tur: "kendi-hesabim" });
  });

  it("büyük/küçük harf farkı eşleşmeyi bozmaz", async () => {
    octokitMock.users.getByUsername.mockResolvedValue({ data: { type: "User" } });
    octokitMock.users.getAuthenticated.mockResolvedValue({ data: { login: "alperenesersu" } });

    const s = await sahipTuruniCoz({ token: "t", owner: "AlperEnesErsu" });
    expect(s).toEqual({ ok: true, tur: "kendi-hesabim" });
  });

  it("⚠️ BAŞKASININ kişisel hesabı REDDEDİLİR", async () => {
    // createForAuthenticatedUser'ın `owner` alanı yok: depo her zaman token'ın
    // sahibi altında açılır. Bu kapı olmasa depo SESSİZCE yanlış hesaba giderdi.
    octokitMock.users.getByUsername.mockResolvedValue({ data: { type: "User" } });
    octokitMock.users.getAuthenticated.mockResolvedValue({ data: { login: "ben" } });

    const s = await sahipTuruniCoz({ token: "t", owner: "baskasi" });

    expect(s.ok).toBe(false);
    if (!s.ok) {
      expect(s.neden).toBe("yetki-yok");
      expect(s.aciklama).toContain("baskasi");
    }
  });

  it("hesap bulunamazsa 'bulunamadi' — kişisel hesap VARSAYILMAZ", async () => {
    octokitMock.users.getByUsername.mockRejectedValue(httpHata(404));

    expect(await sahipTuruniCoz(config)).toEqual({ ok: false, neden: "bulunamadi" });
  });

  it("yetki hatası kişisel hesap sanılmaz", async () => {
    octokitMock.users.getByUsername.mockRejectedValue(httpHata(401));

    expect(await sahipTuruniCoz(config)).toEqual({ ok: false, neden: "yetki-yok" });
  });

  it("sonuç ÖNBELLEKLENİR — hesap türü değişmez", async () => {
    octokitMock.users.getByUsername.mockResolvedValue({ data: { type: "Organization" } });

    await sahipTuruniCoz(config);
    await sahipTuruniCoz(config);
    await sahipTuruniCoz(config);

    expect(octokitMock.users.getByUsername).toHaveBeenCalledTimes(1);
  });

  it("BAŞARISIZ sonuç önbelleklenmez — geçici hata kalıcı olmamalı", async () => {
    octokitMock.users.getByUsername.mockRejectedValueOnce(httpHata(500));
    expect((await sahipTuruniCoz(config)).ok).toBe(false);

    octokitMock.users.getByUsername.mockResolvedValue({ data: { type: "Organization" } });
    expect(await sahipTuruniCoz(config)).toEqual({ ok: true, tur: "organizasyon" });

    // ⚠️ Asıl kanıt SORULMUŞ olması. Yalnız sonuca bakan bir test, hata
    // yolunda yanlışlıkla "organizasyon" önbellekleyen bir sürümden de
    // geçerdi — sonuç aynı görünür, ama tür TAHMİN edilmiş olurdu.
    expect(octokitMock.users.getByUsername).toHaveBeenCalledTimes(2);
  });

  it("FARKLI owner ayrı sorulur — önbellek anahtarı owner'ı içerir", async () => {
    octokitMock.users.getByUsername.mockResolvedValue({ data: { type: "Organization" } });

    await sahipTuruniCoz({ token: "t", owner: "org-a" });
    await sahipTuruniCoz({ token: "t", owner: "org-b" });

    expect(octokitMock.users.getByUsername).toHaveBeenCalledTimes(2);
  });
});
