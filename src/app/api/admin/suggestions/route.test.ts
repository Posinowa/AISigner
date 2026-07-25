import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    suggestion: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET } from "./route";

function authAsAdmin() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "admin-1", role: "ADMIN" } },
  });
}
function req(query = "") {
  return new Request(`http://test/api/admin/suggestions${query}`);
}

describe("admin/suggestions route (#147)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET admin → 200, filtresiz tüm kayıtlar", async () => {
    authAsAdmin();
    prismaMock.suggestion.findMany.mockResolvedValue([{ id: "s1" }]);

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(prismaMock.suggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it("GET ADMIN rolü zorunlu — guard'a 'ADMIN' geçilir", async () => {
    authAsAdmin();
    prismaMock.suggestion.findMany.mockResolvedValue([]);

    await GET(req());

    expect(requireAuthMock).toHaveBeenCalledWith("ADMIN");
  });

  it("GET admin değil → guard yanıtı aynen döner (403)", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 403 }),
    });

    const res = await GET(req());

    expect(res.status).toBe(403);
    expect(prismaMock.suggestion.findMany).not.toHaveBeenCalled();
  });

  it("GET geçerli status filtresi sorguya yansır", async () => {
    authAsAdmin();
    prismaMock.suggestion.findMany.mockResolvedValue([]);

    await GET(req("?status=IN_REVIEW"));

    expect(prismaMock.suggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "IN_REVIEW" } }),
    );
  });

  it("GET geçersiz status → 400", async () => {
    authAsAdmin();

    const res = await GET(req("?status=BILINMEYEN"));

    expect(res.status).toBe(400);
    expect(prismaMock.suggestion.findMany).not.toHaveBeenCalled();
  });

  it("GET yanıtı yazarın parola alanını seçmez", async () => {
    authAsAdmin();
    prismaMock.suggestion.findMany.mockResolvedValue([]);

    await GET(req());

    const select = prismaMock.suggestion.findMany.mock.calls[0][0].select;
    expect(select.author.select).not.toHaveProperty("password");
    expect(select.author.select).toMatchObject({ id: true, email: true });
  });
});
