import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    suggestion: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { PATCH } from "./route";

function authAsAdmin() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "admin-1", role: "ADMIN" } },
  });
}
function patchReq(body: unknown) {
  return new Request("http://test/api/admin/suggestions/s1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const params = Promise.resolve({ id: "s1" });

describe("admin/suggestions/[id] PATCH (#147)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("durum günceller ve inceleyen yöneticiyi damgalar", async () => {
    authAsAdmin();
    prismaMock.suggestion.findUnique.mockResolvedValue({ id: "s1" });
    prismaMock.suggestion.update.mockResolvedValue({ id: "s1", status: "RESOLVED" });

    const res = await PATCH(patchReq({ status: "RESOLVED" }), { params });

    expect(res.status).toBe(200);
    const arg = prismaMock.suggestion.update.mock.calls[0][0];
    expect(arg.data.status).toBe("RESOLVED");
    expect(arg.data.reviewedById).toBe("admin-1");
    expect(arg.data.reviewedAt).toBeInstanceOf(Date);
  });

  it("kayıt yoksa → 404, update çağrılmaz", async () => {
    authAsAdmin();
    prismaMock.suggestion.findUnique.mockResolvedValue(null);

    const res = await PATCH(patchReq({ status: "OPEN" }), { params });

    expect(res.status).toBe(404);
    expect(prismaMock.suggestion.update).not.toHaveBeenCalled();
  });

  it("boş gövde → 400 (en az bir alan gerekli)", async () => {
    authAsAdmin();

    const res = await PATCH(patchReq({}), { params });

    expect(res.status).toBe(400);
    expect(prismaMock.suggestion.update).not.toHaveBeenCalled();
  });

  it("geçersiz durum → 400", async () => {
    authAsAdmin();

    const res = await PATCH(patchReq({ status: "ARSIVLENDI" }), { params });

    expect(res.status).toBe(400);
    expect(prismaMock.suggestion.update).not.toHaveBeenCalled();
  });

  it("admin değil → 403, DB'ye hiç gidilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 403 }),
    });

    const res = await PATCH(patchReq({ status: "RESOLVED" }), { params });

    expect(res.status).toBe(403);
    expect(prismaMock.suggestion.findUnique).not.toHaveBeenCalled();
  });
});
