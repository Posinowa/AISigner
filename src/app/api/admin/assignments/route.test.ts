import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, progressMock, provisionMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  progressMock: vi.fn(),
  provisionMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/features/admin/server/assignment-progress", () => ({
  getStudentAssignmentsProgress: (...a: unknown[]) => progressMock(...a),
}));
vi.mock("@/features/github/server/provisioning", () => ({
  provisionGitHubWorkspace: (...a: unknown[]) => provisionMock(...a),
}));

import { GET, POST } from "./route";

function admin() {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "admin-1", role: "ADMIN" } } });
}
function forbidden() {
  requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(JSON.stringify({ error: "x" }), { status: 403 }) });
}
function postReq(body: unknown) {
  return new Request("http://test/api/admin/assignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin/assignments route (#178-3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET admin değil → 403, veri çekilmez", async () => {
    forbidden();
    const res = await GET();
    expect(res.status).toBe(403);
    expect(progressMock).not.toHaveBeenCalled();
  });

  it("GET admin → 200 ve ilerleme verisi döner", async () => {
    admin();
    progressMock.mockResolvedValue([{ id: "a1" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(progressMock).toHaveBeenCalled();
  });

  it("POST admin değil → 403, provisioning çağrılmaz", async () => {
    forbidden();
    const res = await POST(postReq({ assignmentId: "a1" }));
    expect(res.status).toBe(403);
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it("POST geçersiz assignmentId → 400, provisioning çağrılmaz", async () => {
    admin();
    const res = await POST(postReq({ assignmentId: 123 }));
    expect(res.status).toBe(400);
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it("POST geçerli → provisioning çağrılır ve sonucu döner", async () => {
    admin();
    provisionMock.mockResolvedValue({ success: true, simulated: true });
    const res = await POST(postReq({ assignmentId: "a1" }));
    expect(res.status).toBe(200);
    expect(provisionMock).toHaveBeenCalledWith("a1");
  });
});
