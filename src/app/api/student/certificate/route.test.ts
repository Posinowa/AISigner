// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockGetStudentCertificate, mockEnsureCertificateIssued } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetStudentCertificate: vi.fn(),
  mockEnsureCertificateIssued: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/features/certificate/server/certificate", () => ({
  getStudentCertificate: mockGetStudentCertificate,
  ensureCertificateIssued: mockEnsureCertificateIssued,
}));

import { GET } from "./route";

describe("GET /api/student/certificate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yetkisiz oturumda 401/403 döner", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("APPROVED (henüz mezun olmamış ve issuedAt olmayan) öğrenci sertifika isterse 403 döner (#208)", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "student-1", role: "STUDENT", accountStatus: "APPROVED" } },
    });
    mockGetStudentCertificate.mockResolvedValue({
      studentName: "Ali Yılmaz",
      certificateNumber: "POS-2026-1111",
      completionGrade: null,
      issuedAt: null,
    });

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("mezun durumunda değilsiniz");
  });

  it("GRADUATED öğrenci sertifika verisini başarıyla alır → 200", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "student-1", role: "STUDENT", accountStatus: "GRADUATED" } },
    });
    mockGetStudentCertificate.mockResolvedValue({
      studentName: "Ayşe Yılmaz",
      certificateNumber: "POS-2026-1234",
      completionGrade: "Üstün Başarı",
      issuedAt: "2026-08-08T12:00:00.000Z",
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.certificate.studentName).toBe("Ayşe Yılmaz");
  });

  it("resmi issuedAt tarihi atanmış öğrenci (APPROVED olsa bile) 200 alır", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "student-1", role: "STUDENT", accountStatus: "APPROVED" } },
    });
    mockGetStudentCertificate.mockResolvedValue({
      studentName: "Can Kaya",
      certificateNumber: "POS-2026-5555",
      completionGrade: "Onur Derecesi",
      issuedAt: "2026-08-01T10:00:00.000Z",
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("ADMIN rolündeki kullanıcı sertifikayı sorgulayabilir → 200", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "admin-1", role: "ADMIN", accountStatus: "APPROVED" } },
    });
    mockGetStudentCertificate.mockResolvedValue({
      studentName: "Admin Test",
      certificateNumber: "POS-2026-0001",
      completionGrade: null,
      issuedAt: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
  });
});

