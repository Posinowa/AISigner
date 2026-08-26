// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * #255 — GitHub yapılandırma sözleşmesi.
 *
 * En kritik davranış: token yoksa sistem KIRILMAZ, `null` döner ve çağıran
 * simülasyona düşer. İkincisi: yanlış hesapta gerçek repo açılmasın diye
 * `GITHUB_ORG` boşsa sessizce varsayılana DÜŞÜLMEZ.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  readGitHubConfig,
  getOctokit,
  resetGitHubClientForTests,
  hataNedeni,
  hataMesaji,
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
