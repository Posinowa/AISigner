import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "crypto";
import { webhookImzasiniDogrula, webhookSirriVarMi } from "./webhook-imza";

const SIR = "test-webhook-sirri";
const imzala = (govde: string, sir = SIR) =>
  "sha256=" + crypto.createHmac("sha256", sir).update(govde, "utf8").digest("hex");

afterEach(() => vi.unstubAllEnvs());

describe("webhookSirriVarMi", () => {
  it("sır tanımlıysa true", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);
    expect(webhookSirriVarMi()).toBe(true);
  });

  it("sır boş/boşlukluysa false", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "   ");
    expect(webhookSirriVarMi()).toBe(false);
  });
});

describe("webhookImzasiniDogrula", () => {
  it("doğru imzayı kabul eder", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);
    const govde = '{"action":"closed"}';

    expect(webhookImzasiniDogrula(govde, imzala(govde))).toEqual({ gecerli: true });
  });

  // EN KRİTİK TEST: sır yoksa hiçbir şey doğrulanmış sayılmamalı. "Sır yoksa
  // geç" davranışı, yapılandırma unutulduğunda ucu tamamen açık bırakırdı.
  it("sır TANIMLI DEĞİLSE reddeder (geçirmez)", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "");
    const govde = "{}";

    expect(webhookImzasiniDogrula(govde, imzala(govde))).toEqual({
      gecerli: false,
      neden: "sir-yok",
    });
  });

  it("imza başlığı yoksa reddeder", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);
    expect(webhookImzasiniDogrula("{}", null).gecerli).toBe(false);
  });

  it("sha256= öneki olmayan başlığı reddeder", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);
    expect(webhookImzasiniDogrula("{}", "abc123")).toEqual({
      gecerli: false,
      neden: "bicim-hatali",
    });
  });

  it("YANLIŞ sırla üretilmiş imzayı reddeder", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);
    const govde = '{"action":"closed"}';

    expect(webhookImzasiniDogrula(govde, imzala(govde, "baska-sir")).gecerli).toBe(false);
  });

  // Gövde değiştirilirse imza tutmamalı — saldırgan geçerli bir imzayı alıp
  // içeriği değiştiremesin.
  it("gövde DEĞİŞTİRİLMİŞSE reddeder", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);
    const imza = imzala('{"action":"closed"}');

    expect(webhookImzasiniDogrula('{"action":"opened"}', imza).gecerli).toBe(false);
  });

  it("kısa/uzun imzada PATLAMAZ (timingSafeEqual uzunluk farkında fırlatır)", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);

    expect(() => webhookImzasiniDogrula("{}", "sha256=kisa")).not.toThrow();
    expect(webhookImzasiniDogrula("{}", "sha256=kisa").gecerli).toBe(false);
  });

  it("boş gövdeyi de doğru doğrular", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);
    expect(webhookImzasiniDogrula("", imzala("")).gecerli).toBe(true);
  });
});
