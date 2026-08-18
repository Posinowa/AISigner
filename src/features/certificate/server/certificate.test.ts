import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    studentProfile: { update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  generateCertificateNumber,
  getCertificateVerificationUrl,
  getStudentCertificate,
  updateCertificateDetails,
  verifyCertificate,
  ensureCertificateIssued,
} from "./certificate";

describe("Certificate Service — Staj Başarı Sertifikası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateCertificateNumber — POS-YYYY-XXXX formatında seri no üretir", () => {
    const certNo = generateCertificateNumber("user-12345");
    expect(certNo).toMatch(/^POS-\d{4}-[A-Z0-9]{5}$/);
  });

  it("getCertificateVerificationUrl — geçerli url üretir", () => {
    const url = getCertificateVerificationUrl("POS-2026-TEST1");
    expect(url).toContain("/verify-certificate/POS-2026-TEST1");
  });

  it("getStudentCertificate — öğrenci ve profil yoksa null döner", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await getStudentCertificate("unknown-id");
    expect(result).toBeNull();
  });

  it("getStudentCertificate — grade girilmemişse 'Üstün Başarı' varsaymaz, null döner", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u-1",
      email: "ogrenci@posinowa.com",
      name: "Ali",
      studentProfile: {
        id: "sp-1",
        certificateNumber: "POS-2026-0001",
        completionGrade: null,
        mentorNote: null,
        issuedAt: null,
        mentorAssignments: [],
        assignedProjects: [],
      },
    });

    const cert = await getStudentCertificate("u-1");
    expect(cert).not.toBeNull();
    expect(cert?.completionGrade).toBeNull();
    expect(cert?.issuedAt).toBeNull();
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

    // #208 review (P3): issuedAt GÖNDERİLMEDİYSE dokunulmaz — not kaydetmek belgeyi
    // yayınlamaz (aksi halde mezun olmayan öğrenci public doğrulamada geçerli görünürdü).
    expect(prismaMock.studentProfile.update).toHaveBeenCalledWith({
      where: { id: "sp-1" },
      data: {
        certificateNumber: "POS-2026-9999",
        completionGrade: "Onur Derecesi",
        mentorNote: "Çok başarılı.",
        issuedAt: undefined,
      },
    });
    expect(updated.certificateNumber).toBe("POS-2026-9999");
  });

  describe("verifyCertificate (#208)", () => {
    it("geçersiz veya boş seri no girildiğinde isValid: false döner", async () => {
      const res = await verifyCertificate("   ");
      expect(res.isValid).toBe(false);
    });

    it("kayıt bulunamadığında isValid: false döner", async () => {
      prismaMock.studentProfile.findFirst.mockResolvedValue(null);
      const res = await verifyCertificate("POS-9999-NOTFOUND");
      expect(res.isValid).toBe(false);
      expect(res.message).toContain("bulunamadı");
    });

    it("öğrenci mezun değilse ve issuedAt yoksa isValid: false döner", async () => {
      prismaMock.studentProfile.findFirst.mockResolvedValue({
        id: "sp-1",
        certificateNumber: "POS-2026-1234",
        issuedAt: null,
        user: { id: "u-1", name: "Ali", accountStatus: "APPROVED" },
        mentorAssignments: [],
        assignedProjects: [],
      });

      const res = await verifyCertificate("POS-2026-1234");
      expect(res.isValid).toBe(false);
      expect(res.message).toContain("resmi olarak onaylanmamış");
    });

    it("öğrenci GRADUATED veya issuedAt dolu ise geçerli belge verisi döner", async () => {
      prismaMock.studentProfile.findFirst.mockResolvedValue({
        id: "sp-1",
        certificateNumber: "POS-2026-1234",
        issuedAt: new Date("2026-08-09"),
        completionGrade: "Onur Derecesi",
        user: { id: "u-1", name: "Ayşe", lastName: "Yılmaz", email: "ayse@test.com", accountStatus: "GRADUATED" },
        mentorAssignments: [{ mentor: { name: "Mehmet", lastName: "Öz", email: "mehmet@test.com" } }],
        assignedProjects: [],
      });

      const res = await verifyCertificate("POS-2026-1234");
      expect(res.isValid).toBe(true);
      expect(res.certificate?.studentName).toBe("Ayşe Yılmaz");
      expect(res.certificate?.completionGrade).toBe("Onur Derecesi");
      expect(res.certificate?.mentorName).toBe("Mehmet Öz");
    });
  });

  // #208 review: doğrulanabilirlik sözleşmesi — seri no DB'ye YAZILMADAN "resmi" sayılmaz.
  describe("ensureCertificateIssued — sertifikayı resmileştirme (#208 review)", () => {
    it("seri no/issuedAt yoksa üretir ve KALICI yazar", async () => {
      prismaMock.studentProfile.findUnique.mockResolvedValue({
        id: "sp-1",
        certificateNumber: null,
        issuedAt: null,
      });

      await ensureCertificateIssued("user-abc12");

      expect(prismaMock.studentProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sp-1" },
          data: expect.objectContaining({
            certificateNumber: expect.stringMatching(/^POS-\d{4}-/),
            issuedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("zaten resmileşmişse DOKUNMAZ (idempotent — numara değişmez)", async () => {
      prismaMock.studentProfile.findUnique.mockResolvedValue({
        id: "sp-1",
        certificateNumber: "POS-2026-EXIST",
        issuedAt: new Date("2026-01-01"),
      });

      await ensureCertificateIssued("user-abc12");

      expect(prismaMock.studentProfile.update).not.toHaveBeenCalled();
    });

    it("öğrenci profili yoksa sessizce geçer", async () => {
      prismaMock.studentProfile.findUnique.mockResolvedValue(null);

      await ensureCertificateIssued("yok");

      expect(prismaMock.studentProfile.update).not.toHaveBeenCalled();
    });

    it("seri no VARSA numara değişmez, yalnız issuedAt tamamlanır", async () => {
      prismaMock.studentProfile.findUnique.mockResolvedValue({
        id: "sp-1",
        certificateNumber: "POS-2026-KEEPME",
        issuedAt: null,
      });

      await ensureCertificateIssued("user-abc12");

      expect(prismaMock.studentProfile.update).toHaveBeenCalledWith({
        where: { id: "sp-1" },
        data: { issuedAt: expect.any(Date) },
      });
    });

    it("seri no ÇAKIŞIRSA (P2002) yeni numara üretip yeniden dener", async () => {
      prismaMock.studentProfile.findUnique.mockResolvedValue({
        id: "sp-1",
        certificateNumber: null,
        issuedAt: null,
      });
      const conflict = Object.assign(new Error("Unique constraint"), { code: "P2002" });
      prismaMock.studentProfile.update
        .mockRejectedValueOnce(conflict) // ilk aday çakıştı
        .mockResolvedValueOnce({ id: "sp-1" }); // ikinci aday başarılı

      await ensureCertificateIssued("user-abc12");

      expect(prismaMock.studentProfile.update).toHaveBeenCalledTimes(2);
      const first = prismaMock.studentProfile.update.mock.calls[0][0].data.certificateNumber;
      const second = prismaMock.studentProfile.update.mock.calls[1][0].data.certificateNumber;
      expect(second).not.toBe(first); // yeni aday üretildi
      expect(second).toMatch(/^POS-\d{4}-[A-Z0-9]{5}$/);
    });
  });

  describe("isIssued bayrağı (#208 review)", () => {
    /** getStudentCertificate için minimum user fixture. */
    function mockProfile(over: { certificateNumber: string | null; issuedAt: Date | null }) {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u-1",
        email: "s@test.com",
        name: "Ali",
        lastName: "Veli",
        studentProfile: {
          id: "sp-1",
          certificateNumber: over.certificateNumber,
          issuedAt: over.issuedAt,
          completionGrade: null,
          mentorNote: null,
          mentorAssignments: [],
          assignedProjects: [],
        },
      });
    }

    it("seri no + issuedAt kayıtlıysa isIssued=true", async () => {
      mockProfile({ certificateNumber: "POS-2026-AAAAA", issuedAt: new Date("2026-08-01") });

      const cert = await getStudentCertificate("u-1");

      expect(cert?.isIssued).toBe(true);
    });

    it("kayıtlı değilse isIssued=false (önizleme — doğrulama sorgusu bulamaz)", async () => {
      mockProfile({ certificateNumber: null, issuedAt: null });

      const cert = await getStudentCertificate("u-1");

      expect(cert?.isIssued).toBe(false);
    });
  });
});

