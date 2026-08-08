import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    studentProfile: { update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  generateCertificateNumber,
  getStudentCertificate,
  updateCertificateDetails,
} from "./certificate";

describe("Certificate Service — Staj Başarı Sertifikası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateCertificateNumber — POS-YYYY-XXXX formatında seri no üretir", () => {
    const certNo = generateCertificateNumber("user-12345");
    expect(certNo).toMatch(/^POS-\d{4}-[A-Z0-9]{5}$/);
  });

  it("getStudentCertificate — öğrenci ve profil yoksa null döner", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await getStudentCertificate("unknown-id");
    expect(result).toBeNull();
  });

  it("getStudentCertificate — geçerli öğrenci için tüm sertifika ve proje verilerini derler", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u-1",
      email: "ogrenci@posinowa.com",
      name: "Ahmet",
      lastName: "Kaya",
      studentProfile: {
        id: "sp-1",
        certificateNumber: "POS-2026-8941",
        completionGrade: "Üstün Başarı",
        mentorNote: "Tebrikler, harika bir staj dönemiydi.",
        issuedAt: new Date("2026-08-08"),
        mentorAssignments: [
          {
            mentor: {
              id: "m-1",
              name: "Can",
              lastName: "Demir",
              email: "mentor@posinowa.com",
            },
          },
        ],
        assignedProjects: [
          {
            id: "ap-1",
            projectTemplate: {
              title: "Next.js Fullstack Portal",
              description: "Modern web uygulaması",
              difficulty: "MEDIUM",
              track: ["Frontend", "Fullstack"],
            },
            roadmap: {
              steps: [
                { id: "step-1", status: "COMPLETED" },
                { id: "step-2", status: "COMPLETED" },
              ],
            },
          },
        ],
      },
    });

    const cert = await getStudentCertificate("u-1");
    expect(cert).not.toBeNull();
    expect(cert?.studentName).toBe("Ahmet Kaya");
    expect(cert?.mentorName).toBe("Can Demir");
    expect(cert?.certificateNumber).toBe("POS-2026-8941");
    expect(cert?.completionGrade).toBe("Üstün Başarı");
    expect(cert?.completedProjects).toHaveLength(1);
    expect(cert?.completedProjects[0].completedStepsCount).toBe(2);
  });

  it("updateCertificateDetails — sertifika detaylarını ve referans notunu günceller", async () => {
    prismaMock.studentProfile.update.mockResolvedValue({
      id: "sp-1",
      certificateNumber: "POS-2026-9999",
      completionGrade: "Onur Derecesi",
      mentorNote: "Çok başarılı.",
    });

    const updated = await updateCertificateDetails("sp-1", {
      certificateNumber: "POS-2026-9999",
      completionGrade: "Onur Derecesi",
      mentorNote: "Çok başarılı.",
    });

    expect(prismaMock.studentProfile.update).toHaveBeenCalledWith({
      where: { id: "sp-1" },
      data: {
        certificateNumber: "POS-2026-9999",
        completionGrade: "Onur Derecesi",
        mentorNote: "Çok başarılı.",
        issuedAt: expect.any(Date),
      },
    });
    expect(updated.certificateNumber).toBe("POS-2026-9999");
  });
});
