import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    surveyQuestion: { update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { PATCH, DELETE } from "./route";

function authAdmin() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "u-1", role: "ADMIN" } },
  });
}
function unauthorized() {
  requireAuthMock.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 403 }),
  });
}
const ctx = { params: Promise.resolve({ questionId: "q1" }) };

function patchReq(body: unknown) {
  return new Request("http://test/api/admin/survey-questions/q1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin/survey-questions/[questionId] route (#45)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH admin → günceller (pasifleştirme dahil)", async () => {
    authAdmin();
    prismaMock.surveyQuestion.update.mockResolvedValue({ id: "q1", isActive: false });

    const res = await PATCH(patchReq({ isActive: false }), ctx);

    expect(res.status).toBe(200);
    expect(prismaMock.surveyQuestion.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: { isActive: false },
    });
  });

  it("PATCH geçersiz alan tipi → 400", async () => {
    authAdmin();
    const res = await PATCH(patchReq({ order: "abc" }), ctx);
    expect(res.status).toBe(400);
  });

  it("DELETE admin → success, delete çağrılır", async () => {
    authAdmin();
    prismaMock.surveyQuestion.delete.mockResolvedValue({ id: "q1" });

    const res = await DELETE(new Request("http://test/api/admin/survey-questions/q1", { method: "DELETE" }), ctx);

    expect(res.status).toBe(200);
    expect(prismaMock.surveyQuestion.delete).toHaveBeenCalledWith({ where: { id: "q1" } });
  });

  it("admin değil → 403 (PATCH ve DELETE)", async () => {
    unauthorized();
    expect((await PATCH(patchReq({ question: "x" }), ctx)).status).toBe(403);
    unauthorized();
    expect((await DELETE(new Request("http://test/x", { method: "DELETE" }), ctx)).status).toBe(403);
  });
});
