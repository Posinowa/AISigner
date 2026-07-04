import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, getStoredMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { studentProfile: { findUnique: vi.fn() } },
  getStoredMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/ai/server/profile-analysis-store", () => ({
  getStoredProfileAnalysis: getStoredMock,
}));

import { GET } from "./route";

function authAdmin() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "admin-1", role: "ADMIN" } },
  });
}
function unauthorized() {
  requireAuthMock.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 403 }),
  });
}
const ctx = { params: Promise.resolve({ studentId: "student-1" }) };

describe("GET /api/admin/students/[studentId]/profile-analysis (#48)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin değilse guard yanıtını döner (403)", async () => {
    unauthorized();
    const res = await GET(new Request("http://test"), ctx);
    expect(res.status).toBe(403);
    expect(prismaMock.studentProfile.findUnique).not.toHaveBeenCalled();
  });

  it("öğrenci profili yoksa 404 döner", async () => {
    authAdmin();
    prismaMock.studentProfile.findUnique.mockResolvedValue(null);

    const res = await GET(new Request("http://test"), ctx);

    expect(res.status).toBe(404);
    expect(getStoredMock).not.toHaveBeenCalled();
  });

  it("profil var ama analiz yoksa 200 + analysis:null (empty state)", async () => {
    authAdmin();
    prismaMock.studentProfile.findUnique.mockResolvedValue({ id: "sp-1" });
    getStoredMock.mockResolvedValue(null);

    const res = await GET(new Request("http://test"), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.analysis).toBeNull();
  });

  it("analiz varsa 200 + analiz verisini döner", async () => {
    authAdmin();
    prismaMock.studentProfile.findUnique.mockResolvedValue({ id: "sp-1" });
    getStoredMock.mockResolvedValue({ id: "pa-1", level: "Orta", summary: "özet" });

    const res = await GET(new Request("http://test"), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.analysis).toEqual({ id: "pa-1", level: "Orta", summary: "özet" });
    expect(getStoredMock).toHaveBeenCalledWith("sp-1");
  });
});
