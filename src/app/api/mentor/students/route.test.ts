import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, getStudentsMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  getStudentsMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/mentors/server/actions", () => ({
  getMentorStudents: (...a: unknown[]) => getStudentsMock(...a),
}));

import { GET } from "./route";

describe("mentor students list (#189)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("MENTOR değil → 403, liste çekilmez", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(getStudentsMock).not.toHaveBeenCalled();
  });

  it("liste oturumdaki mentorId ile çekilir (başka mentörün listesi değil)", async () => {
    requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "mentor-1", role: "MENTOR" } } });
    getStudentsMock.mockResolvedValue([{ id: "s1" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(getStudentsMock).toHaveBeenCalledWith("mentor-1");
  });

  it("DB hatası → 500", async () => {
    requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "mentor-1", role: "MENTOR" } } });
    getStudentsMock.mockRejectedValue(new Error("db"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
