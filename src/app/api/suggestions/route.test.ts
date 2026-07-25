import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    suggestion: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET, POST } from "./route";

function authAs(id: string) {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id, role: "STUDENT" } },
  });
}
function unauthorized(status = 401) {
  requireAuthMock.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: "yetkisiz" }), { status }),
  });
}
function postReq(body: unknown) {
  return new Request("http://test/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("suggestions route (#147)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET → yalnızca oturum sahibinin kayıtlarını sorgular", async () => {
    authAs("student-1");
    prismaMock.suggestion.findMany.mockResolvedValue([{ id: "s1" }]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(prismaMock.suggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorId: "student-1" } }),
    );
  });

  it("GET oturum yok → 401", async () => {
    unauthorized();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST geçerli → 201 ve authorId oturumdan alınır", async () => {
    authAs("student-1");
    prismaMock.suggestion.create.mockResolvedValue({ id: "s1" });

    const res = await POST(
      postReq({
        type: "REQUEST",
        title: "Ek kaynak talebi",
        content: "React konusunda ek kaynak paylaşabilir misiniz?",
      }),
    );

    expect(res.status).toBe(201);
    expect(prismaMock.suggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: "student-1", type: "REQUEST" }),
      }),
    );
  });

  it("POST gövdedeki authorId yok sayılır — başkası adına kayıt açılamaz", async () => {
    authAs("student-1");
    prismaMock.suggestion.create.mockResolvedValue({ id: "s1" });

    await POST(
      postReq({
        authorId: "baskasi",
        type: "SUGGESTION",
        title: "Karanlık mod",
        content: "Panelde karanlık mod seçeneği olsa çok iyi olur.",
      }),
    );

    const arg = prismaMock.suggestion.create.mock.calls[0][0];
    expect(arg.data.authorId).toBe("student-1");
  });

  it("POST kısa açıklama → 400, create çağrılmaz", async () => {
    authAs("student-1");

    const res = await POST(
      postReq({ type: "SUGGESTION", title: "Başlık", content: "kısa" }),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.suggestion.create).not.toHaveBeenCalled();
  });

  it("POST geçersiz tip → 400", async () => {
    authAs("student-1");

    const res = await POST(
      postReq({
        type: "SIKAYET",
        title: "Başlık",
        content: "Yeterince uzun bir açıklama metni.",
      }),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.suggestion.create).not.toHaveBeenCalled();
  });
});
