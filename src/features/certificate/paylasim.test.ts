import { describe, it, expect, afterEach, vi } from "vitest";
import { dogrulamaUrl, linkedInEkleUrl } from "./paylasim";

afterEach(() => vi.unstubAllEnvs());

describe("dogrulamaUrl", () => {
  it("public doğrulama sayfasına işaret eder", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://aisigner.example.com");
    expect(dogrulamaUrl("POS-2026-0001")).toBe(
      "https://aisigner.example.com/verify-certificate/POS-2026-0001",
    );
  });

  it("sondaki eğik çizgiyi tekrarlamaz", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://x.com/");
    expect(dogrulamaUrl("A")).toBe("https://x.com/verify-certificate/A");
  });

  it("seri numarasını URL için kaçırır", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://x.com");
    expect(dogrulamaUrl("POS 2026/01")).toContain("POS%202026%2F01");
  });
});

describe("linkedInEkleUrl", () => {
  const al = (u: string) => new URL(u).searchParams;

  it("LinkedIn sertifika ekleme formuna gider", () => {
    const u = linkedInEkleUrl({ certificateNumber: "POS-1", issuedAt: null });
    expect(u.startsWith("https://www.linkedin.com/profile/add?")).toBe(true);
    expect(al(u).get("startTask")).toBe("CERTIFICATION_NAME");
  });

  it("seri no ve doğrulama adresini taşır", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://x.com");
    const p = al(linkedInEkleUrl({ certificateNumber: "POS-1", issuedAt: null }));
    expect(p.get("certId")).toBe("POS-1");
    // Kritik: LinkedIn kaydından doğrulamaya tıklanabilir yol kalmalı.
    expect(p.get("certUrl")).toBe("https://x.com/verify-certificate/POS-1");
  });

  it("tarih verilirse yıl/ay doldurulur", () => {
    const p = al(linkedInEkleUrl({ certificateNumber: "A", issuedAt: "2026-03-15T10:00:00Z" }));
    expect(p.get("issueYear")).toBe("2026");
    expect(p.get("issueMonth")).toBe("3");
  });

  it("tarih YOKSA yıl/ay HİÇ gönderilmez", () => {
    // Eksik tarihte LinkedIn formu yanlış dolduruyor ve kullanıcı fark etmeyebiliyor.
    const p = al(linkedInEkleUrl({ certificateNumber: "A", issuedAt: null }));
    expect(p.has("issueYear")).toBe(false);
    expect(p.has("issueMonth")).toBe(false);
  });

  it("geçersiz tarih de gönderilmez", () => {
    const p = al(linkedInEkleUrl({ certificateNumber: "A", issuedAt: "bozuk" }));
    expect(p.has("issueYear")).toBe(false);
  });
});
