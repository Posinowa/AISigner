// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

const { mockVerifyCertificate } = vi.hoisted(() => ({
  mockVerifyCertificate: vi.fn(),
}));

vi.mock("@/features/certificate/server/certificate", () => ({
  verifyCertificate: mockVerifyCertificate,
}));

// #208 review: sayfa artık rate-limit için istek başlıklarını okuyor.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.10" }),
}));

import VerifyCertificatePage, { generateMetadata } from "./page";

describe("VerifyCertificatePage (#208)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
