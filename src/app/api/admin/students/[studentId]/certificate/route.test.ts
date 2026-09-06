// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockGetStudentCertificate, mockUpdateCertificateDetails, mockPrisma } =
  vi.hoisted(() => ({
    mockRequireAuth: vi.fn(),
    mockGetStudentCertificate: vi.fn(),
    mockUpdateCertificateDetails: vi.fn(),
    mockPrisma: { studentProfile: { findFirst: vi.fn() } },
  }));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/features/certificate/server/certificate", () => ({
  getStudentCertificate: mockGetStudentCertificate,
  updateCertificateDetails: mockUpdateCertificateDetails,
}));

import { GET, POST } from "./route";

describe("GET & POST /api/admin/students/[studentId]/certificate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET: yetkisiz ise 401 döner", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const req = new Request("http://localhost/api/admin/students/s1/certificate");
    const res = await GET(req, { params: Promise.resolve({ studentId: "s1" }) });
    expect(res.status).toBe(401);
  });

  it("GET: yetkili admin için sertifika verisini döner", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "admin-1", role: "ADMIN" } },
    });
    mockGetStudentCertificate.mockResolvedValue({
      id: "sp-1",
      studentName: "Örnek Öğrenci",
    });

    const req = new Request("http://localhost/api/admin/students/s1/certificate");
    const res = await GET(req, { params: Promise.resolve({ studentId: "s1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("GET: atanmış mentör kendi öğrencisinin sertifikasını görür → 200", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "mentor-1", role: "MENTOR" } },
    });
    mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: "sp-1" }); // atanmış
    mockGetStudentCertificate.mockResolvedValue({ id: "sp-1", studentName: "Örnek" });

    const req = new Request("http://localhost/api/admin/students/s1/certificate");
    const res = await GET(req, { params: Promise.resolve({ studentId: "s1" }) });
    expect(res.status).toBe(200);
  });

  it("GET: BAŞKA öğrencinin mentörü → 403, sertifika derlenmez (IDOR kilidi)", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "baska-mentor", role: "MENTOR" } },
    });
    mockPrisma.studentProfile.findFirst.mockResolvedValue(null); // atanmamış

    const req = new Request("http://localhost/api/admin/students/s1/certificate");
    const res = await GET(req, { params: Promise.resolve({ studentId: "s1" }) });
    expect(res.status).toBe(403);
    expect(mockGetStudentCertificate).not.toHaveBeenCalled();
  });

  it("POST: geçerli veriyle sertifika detaylarını ve referans notunu günceller", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "admin-1", role: "ADMIN" } },
    });
    mockGetStudentCertificate.mockResolvedValue({
      id: "sp-1",
      studentName: "Örnek Öğrenci",
    });
    mockUpdateCertificateDetails.mockResolvedValue({
      id: "sp-1",
      mentorNote: "Üstün performans.",
    });

    const req = new Request("http://localhost/api/admin/students/s1/certificate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completionGrade: "Üstün Başarı",
        mentorNote: "Üstün performans.",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ studentId: "s1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockUpdateCertificateDetails).toHaveBeenCalled();
  });

  it("POST: geçersiz completionGrade durumunda 400 döner", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "admin-1", role: "ADMIN" } },
    });

    const req = new Request("http://localhost/api/admin/students/s1/certificate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completionGrade: "GecersizDeger",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ studentId: "s1" }) });
    expect(res.status).toBe(400);
  });
});

