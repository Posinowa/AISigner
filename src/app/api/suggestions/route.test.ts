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
function getReq(query = "") {
  return new Request(`http://test/api/suggestions${query}`);
}
function postReq(body: unknown) {
  return new Request("http://test/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const validBody = {
  type: "SUGGESTION",
  title: "Karanlık mod",
  content: "Panelde karanlık mod seçeneği olsa çok iyi olur.",
};

// Rate limiter proses-yerel ve testler arası taşar; her testte benzersiz kullanıcı.
let userSeq = 0;
const freshUser = () => `student-${++userSeq}`;

describe("suggestions route (#147/#163)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.suggestion.findMany.mockResolvedValue([]);
  });

  it("GET → yalnızca oturum sahibinin kayıtlarını sorgular", async () => {
    authAs("student-1");
    prismaMock.suggestion.findMany.mockResolvedValue([{ id: "s1" }]);

    const res = await GET(getReq());

    expect(res.status).toBe(200);
    expect(prismaMock.suggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorId: "student-1" } }),
    );
  });

  it("GET yanıtı sayfalama zarfı döner ({items, nextCursor})", async () => {
    authAs("student-1");
    prismaMock.suggestion.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    const json = await (await GET(getReq())).json();

    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("nextCursor");
    expect(json.items).toHaveLength(2);
  });

  it("GET limit+1 kayıt gelirse nextCursor son görünen kaydın id'si olur", async () => {
    authAs("student-1");
    // limit=2 istenirse server take:3 sorgular; 3 kayıt gelirse "daha var" demektir.
    prismaMock.suggestion.findMany.mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);

    const json = await (await GET(getReq("?limit=2"))).json();

    expect(json.items.map((i: { id: string }) => i.id)).toEqual(["a", "b"]);
    expect(json.nextCursor).toBe("b");
    expect(prismaMock.suggestion.findMany.mock.calls[0][0].take).toBe(3);
  });

  it("GET cursor verilirse sayfalama parametreleri eklenir", async () => {
    authAs("student-1");

    await GET(getReq("?cursor=s9"));

    const args = prismaMock.suggestion.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "s9" });
    expect(args.skip).toBe(1);
  });

  it("GET geçersiz limit → 400", async () => {
    authAs("student-1");

    const res = await GET(getReq("?limit=-5"));

    expect(res.status).toBe(400);
    expect(prismaMock.suggestion.findMany).not.toHaveBeenCalled();
  });

  it("GET oturum yok → 401", async () => {
    unauthorized();
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it("POST geçerli → 201 ve authorId oturumdan alınır", async () => {
    authAs(freshUser());
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
        data: expect.objectContaining({ type: "REQUEST" }),
      }),
    );
  });

  it("POST gövdedeki authorId yok sayılır — başkası adına kayıt açılamaz", async () => {
    const id = freshUser();
    authAs(id);
    prismaMock.suggestion.create.mockResolvedValue({ id: "s1" });

    await POST(postReq({ ...validBody, authorId: "baskasi" }));

    expect(prismaMock.suggestion.create.mock.calls[0][0].data.authorId).toBe(id);
  });

  it("POST kısa açıklama → 400, create çağrılmaz", async () => {
    authAs(freshUser());

    const res = await POST(
      postReq({ type: "SUGGESTION", title: "Başlık", content: "kısa" }),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.suggestion.create).not.toHaveBeenCalled();
  });

  it("POST geçersiz tip → 400", async () => {
    authAs(freshUser());

    const res = await POST(
      postReq({ type: "SIKAYET", title: "Başlık", content: "Yeterince uzun bir açıklama." }),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.suggestion.create).not.toHaveBeenCalled();
  });

  it("POST hız sınırı: 10 kayıt geçer, 11. istek → 429 (#163 P1)", async () => {
    const id = freshUser();
    authAs(id);
    prismaMock.suggestion.create.mockResolvedValue({ id: "s1" });

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await POST(postReq(validBody));
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("POST 429 yanıtında Retry-After başlığı bulunur", async () => {
    const id = freshUser();
    authAs(id);
    prismaMock.suggestion.create.mockResolvedValue({ id: "s1" });

    for (let i = 0; i < 10; i++) await POST(postReq(validBody));
    const res = await POST(postReq(validBody));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});
