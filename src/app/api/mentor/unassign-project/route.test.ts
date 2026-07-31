import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, unassignMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  unassignMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/mentors/server/actions", () => ({
  unassignProject: (...a: unknown[]) => unassignMock(...a),
}));

import { DELETE } from "./route";

function mentor(id: string) {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "MENTOR" } } });
}
function req(body: unknown) {
  return new Request("http://t", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("unassign-project route (#184)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("MENTOR değil (guard) → 403, action çağrılmaz", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await DELETE(req({ assignedProjectId: "ap-1" }));
    expect(res.status).toBe(403);
    expect(unassignMock).not.toHaveBeenCalled();
  });

  it("geçersiz gövde → 400", async () => {
    mentor("mentor-1");
    const res = await DELETE(req({}));
    expect(res.status).toBe(400);
    expect(unassignMock).not.toHaveBeenCalled();
  });

  it("mentorId gövdeden DEĞİL oturumdan alınır (spoof engeli)", async () => {
    mentor("mentor-1");
    unassignMock.mockResolvedValue({});
    await DELETE(req({ assignedProjectId: "ap-1", mentorId: "baska-mentor", force: false }));
    // 2. argüman: her zaman oturum sahibinin id'si
    expect(unassignMock).toHaveBeenCalledWith("ap-1", "mentor-1", false);
  });

  it("action REQUIRES_CONFIRMATION fırlatırsa → 409", async () => {
    mentor("mentor-1");
    const err = Object.assign(new Error("onay gerekiyor"), { code: "REQUIRES_CONFIRMATION" });
    unassignMock.mockRejectedValue(err);
    const res = await DELETE(req({ assignedProjectId: "ap-1" }));
    expect(res.status).toBe(409);
  });

  it("başarılı → 200", async () => {
    mentor("mentor-1");
    unassignMock.mockResolvedValue({});
    const res = await DELETE(req({ assignedProjectId: "ap-1", force: true }));
    expect(res.status).toBe(200);
    expect(unassignMock).toHaveBeenCalledWith("ap-1", "mentor-1", true);
  });
});
