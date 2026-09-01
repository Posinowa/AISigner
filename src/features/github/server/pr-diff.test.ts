// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #327 — MALİYET SINIRLARI. Bu testler faturayı koruyor: filtreler veya
 * bütçe kırpması sessizce bozulursa tek bir `package-lock.json` değişikliği
 * Gemini'ye on binlerce token gönderebilir.
 */

const { octokitMock } = vi.hoisted(() => ({
  octokitMock: { pulls: { listFiles: vi.fn() } },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
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
  prDiffiniAl,
  elenirMi,
  MAKS_DOSYA,
  TOPLAM_DIFF_SINIRI,
  DOSYA_DIFF_SINIRI,
} from "./pr-diff";

const config = { token: "t", owner: "o" };
const params = { repo: "r", prNumarasi: 1 };

const dosya = (filename: string, yamaUzunluk = 100) => ({
  filename,
  status: "modified",
  patch: "x".repeat(yamaUzunluk),
});

beforeEach(() => vi.clearAllMocks());

describe("elenirMi", () => {
  it("üretilmiş dosyaları eler", () => {
    for (const yol of [
      "package-lock.json",
      "apps/web/package-lock.json",
      "pnpm-lock.yaml",
      "node_modules/x/index.js",
      "dist/app.js",
      ".next/server/page.js",
      "src/__snapshots__/a.snap",
      "public/vendor.min.js",
      "public/logo.png",
      "assets/font.woff2",
    ]) {
      expect(elenirMi(yol), yol).toBe(true);
    }
  });

  it("kaynak dosyalara dokunmaz", () => {
    for (const yol of [
      "src/app/page.tsx",
      "src/lib/rate-limit.ts",
      "prisma/schema.prisma",
      "distribution/notes.md", // "dist/" desenine takılmamalı
      "src/components/Icon.tsx",
    ]) {
      expect(elenirMi(yol), yol).toBe(false);
    }
  });
});

describe("prDiffiniAl", () => {
  it("elenen dosyaları çıkarır ve sayısını bildirir", async () => {
    octokitMock.pulls.listFiles.mockResolvedValue({
      data: [dosya("src/a.ts"), dosya("package-lock.json"), dosya("dist/b.js")],
    });

    const s = await prDiffiniAl(config, params);

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.dosyalar.map((d) => d.yol)).toEqual(["src/a.ts"]);
    expect(s.elenenSayisi).toBe(2);
    // Bir şeyler elendiğinde bunu yorumda dürüstçe söyleyebilmeliyiz.
    expect(s.kirpildi).toBe(true);
  });

  it("yalnızca üretilmiş dosya değiştiyse AI'yı HİÇ çağırtmaz", async () => {
    // Boş bir diff için para ödemenin anlamı yok.
    octokitMock.pulls.listFiles.mockResolvedValue({
      data: [dosya("package-lock.json")],
    });

    const s = await prDiffiniAl(config, params);

    expect(s).toEqual({ ok: false, neden: "incelenecek-degisiklik-yok" });
  });

  it("ikili dosyaları (patch alanı yok) atlar", async () => {
    octokitMock.pulls.listFiles.mockResolvedValue({
      data: [{ filename: "src/a.bin", status: "added" }],
    });

    const s = await prDiffiniAl(config, params);
    expect(s).toEqual({ ok: false, neden: "incelenecek-degisiklik-yok" });
  });

  it("dosya sayısını MAKS_DOSYA ile sınırlar", async () => {
    octokitMock.pulls.listFiles.mockResolvedValue({
      data: Array.from({ length: MAKS_DOSYA + 5 }, (_, i) => dosya(`src/a${i}.ts`)),
    });

    const s = await prDiffiniAl(config, params);

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.dosyalar).toHaveLength(MAKS_DOSYA);
    expect(s.kirpildi).toBe(true);
  });

  it("tek dosyanın payını DOSYA_DIFF_SINIRI ile sınırlar", async () => {
    octokitMock.pulls.listFiles.mockResolvedValue({
      data: [dosya("src/dev.ts", DOSYA_DIFF_SINIRI + 5_000)],
    });

    const s = await prDiffiniAl(config, params);

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.dosyalar[0].yama).toHaveLength(DOSYA_DIFF_SINIRI);
    expect(s.kirpildi).toBe(true);
  });

  it("toplam bütçeyi aşmaz", async () => {
    octokitMock.pulls.listFiles.mockResolvedValue({
      data: Array.from({ length: 20 }, (_, i) => dosya(`src/a${i}.ts`, DOSYA_DIFF_SINIRI)),
    });

    const s = await prDiffiniAl(config, params);

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const toplam = s.dosyalar.reduce((t, d) => t + d.yama.length, 0);
    expect(toplam).toBeLessThanOrEqual(TOPLAM_DIFF_SINIRI);
    expect(s.kirpildi).toBe(true);
  });

  it("sınır altında kalan normal PR'ı olduğu gibi geçirir", async () => {
    octokitMock.pulls.listFiles.mockResolvedValue({
      data: [dosya("src/a.ts", 500), dosya("src/b.ts", 500)],
    });

    const s = await prDiffiniAl(config, params);

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.dosyalar).toHaveLength(2);
    expect(s.elenenSayisi).toBe(0);
    expect(s.kirpildi).toBe(false);
  });

  it("GitHub hatasında ham hatayı sızdırmaz, nedeni döndürür", async () => {
    octokitMock.pulls.listFiles.mockRejectedValue({ status: 404 });

    const s = await prDiffiniAl(config, params);

    expect(s).toEqual({ ok: false, neden: "bulunamadi" });
  });
});
