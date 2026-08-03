import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, getMentorsMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  getMentorsMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/admin/server/user", () => ({
  getMentors: (...a: unknown[]) => getMentorsMock(...a),
}));

import { GET } from "./route";

describe("admin mentors list (#189)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ADMIN değil → 403, liste çekilmez", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(getMentorsMock).not.toHaveBeenCalled();
  });

  it("ADMIN → 200 ve liste döner", async () => {
    requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "admin-1", role: "ADMIN" } } });
    getMentorsMock.mockResolvedValue([{ id: "m1" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(getMentorsMock).toHaveBeenCalled();
  });
});
