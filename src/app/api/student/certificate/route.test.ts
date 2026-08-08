// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockGetStudentCertificate } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetStudentCertificate: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/features/certificate/server/certificate", () => ({
  getStudentCertificate: mockGetStudentCertificate,
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

  it("sertifika bulunursa 200 ve sertifika verisini döner", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "student-1", role: "STUDENT" } },
    });
    mockGetStudentCertificate.mockResolvedValue({
      studentName: "Ayşe Yılmaz",
      certificateNumber: "POS-2026-1234",
      completionGrade: "Üstün Başarı",
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.certificate.studentName).toBe("Ayşe Yılmaz");
  });
});
