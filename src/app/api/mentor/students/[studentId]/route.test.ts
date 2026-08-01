import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, getStudentDetailMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  getStudentDetailMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/mentors/server/actions", () => ({
  getStudentDetail: (...a: unknown[]) => getStudentDetailMock(...a),
}));

import { GET } from "./route";

function mentor(id: string) {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "MENTOR" } } });
}
const ctx = (studentId = "st-1") => ({ params: Promise.resolve({ studentId }) });

describe("mentor student detail GET (#187)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("MENTOR değil → 403, veri çekilmez", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await GET(new Request("http://t"), ctx());
    expect(res.status).toBe(403);
    expect(getStudentDetailMock).not.toHaveBeenCalled();
  });

  it("sahiplik: getStudentDetail'e (studentId, oturumdaki mentorId) geçilir", async () => {
    mentor("mentor-1");
    getStudentDetailMock.mockResolvedValue({ id: "st-1" });
    await GET(new Request("http://t"), ctx("st-1"));
    // mentorId gövdeden değil oturumdan → başka mentörün öğrencisi çekilemez
    expect(getStudentDetailMock).toHaveBeenCalledWith("st-1", "mentor-1");
  });

  it("öğrenci bu mentöre atanmamışsa (null) → 404", async () => {
    mentor("mentor-1");
    getStudentDetailMock.mockResolvedValue(null);
    const res = await GET(new Request("http://t"), ctx());
    expect(res.status).toBe(404);
  });

  it("kendi öğrencisi → 200", async () => {
    mentor("mentor-1");
    getStudentDetailMock.mockResolvedValue({ id: "st-1", name: "Ali" });
    const res = await GET(new Request("http://t"), ctx());
    expect(res.status).toBe(200);
  });
});
