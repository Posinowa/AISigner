import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, getModelMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { roadmap: { findUnique: vi.fn() } },
  getModelMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/gemini-client", () => ({ getModel: (...a: unknown[]) => getModelMock(...a) }));

import { POST } from "./route";

const ctx = { params: Promise.resolve({ roadmapId: "r-1" }) };
function req(body: unknown = {}) {
  return new Request("http://test/api/mentor/roadmap/r-1/ai-step", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("mentor ai-step route — yetki (#178-3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("MENTOR rolü zorunlu — guard'a geçirilir", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(requireAuthMock).toHaveBeenCalledWith("MENTOR");
    expect(prismaMock.roadmap.findUnique).not.toHaveBeenCalled();
  });

  it("roadmap yoksa 404", async () => {
    requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "m", role: "MENTOR" } } });
    prismaMock.roadmap.findUnique.mockResolvedValue(null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
  });
});
