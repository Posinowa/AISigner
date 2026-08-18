// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

const { mockVerifyCertificate, mockCheck } = vi.hoisted(() => ({
  mockVerifyCertificate: vi.fn(),
  mockCheck: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
}));

vi.mock("@/features/certificate/server/certificate", () => ({
  verifyCertificate: mockVerifyCertificate,
}));

// #208 review: sayfa artık rate-limit için istek başlıklarını okuyor.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.10" }),
}));

// Rate-limit davranışını testte kontrol edebilmek için limiter mock'lanır.
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: mockCheck }),
}));

import VerifyCertificatePage, { generateMetadata } from "./page";

describe("VerifyCertificatePage (#208)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheck.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("geçerli sertifika için doğrulanmış belge detaylarını render eder", async () => {
    mockVerifyCertificate.mockResolvedValue({
      isValid: true,
      certificate: {
        certificateNumber: "POS-2026-TEST1",
        studentName: "Mehmet Demir",
        issuedAt: "2026-08-08T10:00:00.000Z",
        completionGrade: "Üstün Başarı",
        mentorName: "Can Demir",
        completedProjects: [
          {
            id: "p-1",
            title: "Next.js Entegrasyon Projesi",
            difficulty: "MEDIUM",
            track: ["Frontend"],
            completedStepsCount: 3,
            totalStepsCount: 3,
          },
        ],
      },
    });

    const jsx = await VerifyCertificatePage({
      params: Promise.resolve({ certificateNumber: "POS-2026-TEST1" }),
    });
    render(jsx);

    expect(screen.getByRole("heading", { level: 1, name: /Staj Başarı Sertifikası Geçerlidir/ })).toBeInTheDocument();
    expect(screen.getByText("Mehmet Demir")).toBeInTheDocument();
    expect(screen.getByText("POS-2026-TEST1")).toBeInTheDocument();
    expect(screen.getByText("Üstün Başarı")).toBeInTheDocument();
    expect(screen.getByText("Can Demir")).toBeInTheDocument();
    expect(screen.getByText("Next.js Entegrasyon Projesi")).toBeInTheDocument();
  });

  it("geçersiz veya bulunamayan sertifikada hata ekranı render eder", async () => {
    mockVerifyCertificate.mockResolvedValue({
      isValid: false,
      message: "Bu seri numarasına ait kayıtlı sertifika bulunamadı.",
    });

    const jsx = await VerifyCertificatePage({
      params: Promise.resolve({ certificateNumber: "INVALID-NO" }),
    });
    render(jsx);

    expect(screen.getByRole("heading", { level: 1, name: "Sertifika Doğrulanamadı" })).toBeInTheDocument();
    expect(screen.getByText(/kayıtlı sertifika bulunamadı/)).toBeInTheDocument();
  });

  it("generateMetadata — geçerli ve geçersiz durumlarda doğru SEO başlığı üretir", async () => {
    mockVerifyCertificate.mockResolvedValueOnce({
      isValid: true,
      certificate: {
        certificateNumber: "POS-2026-SEO",
        studentName: "Zeynep Kaya",
      },
    });

    const metaValid = await generateMetadata({
      params: Promise.resolve({ certificateNumber: "POS-2026-SEO" }),
    });
    expect(metaValid.title).toContain("Zeynep Kaya");

    mockVerifyCertificate.mockResolvedValueOnce({
      isValid: false,
    });
    const metaInvalid = await generateMetadata({
      params: Promise.resolve({ certificateNumber: "INVALID" }),
    });
    expect(metaInvalid.title).toContain("Sertifika Doğrulama");
  });

  // #208 review: Next.js metadata'yı sayfadan ÖNCE üretir. Limit yalnız gövdede
  // olsaydı, 429 ekranı gösterilse bile <title> öğrenci adını + seri no'yu sızdırırdı.
  describe("rate-limit — enumeration/PII sızıntısı (#208 review)", () => {
    const RATE_LIMITED = { allowed: false, retryAfterSeconds: 60 };

    it("limit aşıldığında metadata'da öğrenci adı/seri no BULUNMAZ ve DB'ye gidilmez", async () => {
      mockCheck.mockReturnValue(RATE_LIMITED);
      mockVerifyCertificate.mockResolvedValue({
        isValid: true,
        certificate: {
          certificateNumber: "POS-2026-SECRET",
          studentName: "Ayşe Yılmaz",
          issuedAt: "2026-08-08T10:00:00.000Z",
          completionGrade: "Üstün Başarı",
          mentorName: "Can Demir",
          completedProjects: [],
        },
      });

      const meta = await generateMetadata({
        params: Promise.resolve({ certificateNumber: "POS-2026-SECRET" }),
      });

      const serialized = `${meta.title ?? ""} ${meta.description ?? ""}`;
      expect(serialized).not.toContain("Ayşe Yılmaz");
      expect(serialized).not.toContain("POS-2026-SECRET");
      expect(meta.title).toContain("Sertifika Doğrulama"); // generic başlık
      // Limit aşıldığında doğrulama sorgusu hiç çalıştırılmaz.
      expect(mockVerifyCertificate).not.toHaveBeenCalled();
    });

    it("limit aşıldığında sayfa 'çok fazla deneme' ekranı gösterir", async () => {
      mockCheck.mockReturnValue(RATE_LIMITED);

      const ui = await VerifyCertificatePage({
        params: Promise.resolve({ certificateNumber: "POS-2026-LIMIT" }),
      });
      render(ui);

      expect(screen.getByText(/çok fazla doğrulama denemesi/i)).toBeInTheDocument();
      expect(mockVerifyCertificate).not.toHaveBeenCalled();
    });

    it("PII sayfası arama motorlarına indekslenmez (robots noindex)", async () => {
      mockVerifyCertificate.mockResolvedValue({ isValid: false });

      const meta = await generateMetadata({
        params: Promise.resolve({ certificateNumber: "POS-2026-NOINDEX" }),
      });

      expect(meta.robots).toMatchObject({ index: false });
    });
  });
});
