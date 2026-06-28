import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    surveyQuestion: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET, POST } from "./route";

function authAs(role: "ADMIN" | "MENTOR" | "STUDENT") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "u-1", role } },
  });
}
function unauthorized(status = 403) {
  requireAuthMock.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: "yetkisiz" }), { status }),
  });
}
function postReq(body: unknown) {
  return new Request("http://test/api/admin/survey-questions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin/survey-questions route (#45)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET admin → 200 ve liste döner", async () => {
    authAs("ADMIN");
    prismaMock.surveyQuestion.findMany.mockResolvedValue([{ id: "q1", question: "Neden?" }]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
  });

  it("GET admin değil → 403", async () => {
    unauthorized();
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("POST admin geçerli → 201, create çağrılır", async () => {
    authAs("ADMIN");
    prismaMock.surveyQuestion.create.mockResolvedValue({ id: "q1" });

    const res = await POST(postReq({ question: "Hangi dili biliyorsun?", options: ["JS", "Python"] }));

    expect(res.status).toBe(201);
    expect(prismaMock.surveyQuestion.create).toHaveBeenCalledOnce();
  });

  it("POST boş soru → 400, create yok", async () => {
    authAs("ADMIN");
    const res = await POST(postReq({ question: "" }));
    expect(res.status).toBe(400);
    expect(prismaMock.surveyQuestion.create).not.toHaveBeenCalled();
  });

  it("POST admin değil → 403", async () => {
    unauthorized();
    const res = await POST(postReq({ question: "x" }));
    expect(res.status).toBe(403);
  });
});
