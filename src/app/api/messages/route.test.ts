import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    message: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    studentProfile: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET, POST } from "./route";

function authAs(id: string, role: "MENTOR" | "STUDENT" | "ADMIN") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id, role } },
  });
}

function getReq(query: string) {
  return new Request(`http://test/api/messages${query}`);
}

function postReq(body: unknown) {
  return new Request("http://test/api/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Mentör–öğrenci ilişkisi yok: her iki yönde de eşleşme bulunmuyor. */
function noRelationship() {
  prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });
  prismaMock.studentProfile.findFirst.mockResolvedValue(null);
}

/** Karşı taraf benim öğrencim. */
function isMyStudent() {
  prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });
  prismaMock.studentProfile.findFirst.mockResolvedValueOnce({ id: "p1" });
}

describe("messages route — yetki sınırları (#158)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.message.findMany.mockResolvedValue([]);
    prismaMock.message.updateMany.mockResolvedValue({ count: 0 });
  });

  it("ilişkisiz kullanıcının konuşmasına GET → 403, mesajlar hiç sorgulanmaz", async () => {
    authAs("mentor-1", "MENTOR");
    noRelationship();

    const res = await GET(getReq("?conversationWith=yabanci-1"));

    expect(res.status).toBe(403);
    expect(prismaMock.message.findMany).not.toHaveBeenCalled();
  });

  it("kendi öğrencisiyle GET → 200 ve sorgu iki tarafla sınırlı", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    const res = await GET(getReq("?conversationWith=ogrenci-1"));

    expect(res.status).toBe(200);
    const where = prismaMock.message.findMany.mock.calls[0][0].where;
    // Sorgu yalnızca bu iki kişi arasındaki mesajları kapsamalı
    expect(where.OR).toEqual([
      { senderId: "mentor-1", receiverId: "ogrenci-1" },
      { senderId: "ogrenci-1", receiverId: "mentor-1" },
    ]);
  });

  it("ilişkisiz kullanıcıya POST → 403, mesaj oluşturulmaz", async () => {
    authAs("student-1", "STUDENT");
    noRelationship();

    const res = await POST(postReq({ receiverId: "yabanci-1", content: "merhaba" }));

    expect(res.status).toBe(403);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it("gönderen her zaman oturumdan alınır — başkası adına mesaj atılamaz", async () => {
    authAs("student-1", "STUDENT");
    isMyStudent();
    prismaMock.message.create.mockResolvedValue({ id: "m1" });

    await POST(
      postReq({ senderId: "baskasi", receiverId: "mentor-1", content: "merhaba" }),
    );

    const data = prismaMock.message.create.mock.calls[0][0].data;
    expect(data.senderId).toBe("student-1");
  });

  it("kendine mesaj gönderilemez", async () => {
    authAs("student-1", "STUDENT");

    const res = await POST(postReq({ receiverId: "student-1", content: "merhaba" }));

    expect(res.status).toBe(400);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it("ADMIN var olmayan kullanıcıya mesaj atamaz", async () => {
    authAs("admin-1", "ADMIN");
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await POST(postReq({ receiverId: "yok-1", content: "merhaba" }));

    expect(res.status).toBe(403);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it("herkes ADMIN'e mesaj atabilir (öğrenci → yönetici kanalı)", async () => {
    authAs("student-1", "STUDENT");
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    prismaMock.message.create.mockResolvedValue({ id: "m1" });

    const res = await POST(postReq({ receiverId: "admin-1", content: "merhaba" }));

    expect(res.status).toBe(201);
  });
});

describe("messages route — sorgu doğrulama (#158)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.message.findMany.mockResolvedValue([]);
    prismaMock.message.updateMany.mockResolvedValue({ count: 0 });
  });

  it("conversationWith eksikse → 400", async () => {
    authAs("mentor-1", "MENTOR");

    const res = await GET(getReq(""));

    expect(res.status).toBe(400);
    expect(prismaMock.message.findMany).not.toHaveBeenCalled();
  });

  it("sayı olmayan limit → 400 (önceden Prisma'ya NaN gidip 500 oluyordu)", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    const res = await GET(getReq("?conversationWith=ogrenci-1&limit=abc"));

    expect(res.status).toBe(400);
    expect(prismaMock.message.findMany).not.toHaveBeenCalled();
  });

  it("negatif limit → 400 (önceden ters yönde sayfalama yapıyordu)", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    const res = await GET(getReq("?conversationWith=ogrenci-1&limit=-5"));

    expect(res.status).toBe(400);
    expect(prismaMock.message.findMany).not.toHaveBeenCalled();
  });

  it("limit=0 → 400", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    const res = await GET(getReq("?conversationWith=ogrenci-1&limit=0"));

    expect(res.status).toBe(400);
  });

  it("50 üstü limit → 400 (üst sınır korunur)", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    const res = await GET(getReq("?conversationWith=ogrenci-1&limit=500"));

    expect(res.status).toBe(400);
  });

  it("limit verilmezse varsayılan 30 kullanılır", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    await GET(getReq("?conversationWith=ogrenci-1"));

    // take = limit + 1 (hasMore tespiti için)
    expect(prismaMock.message.findMany.mock.calls[0][0].take).toBe(31);
  });

  it("geçerli limit Prisma'ya doğru geçer", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    await GET(getReq("?conversationWith=ogrenci-1&limit=10"));

    expect(prismaMock.message.findMany.mock.calls[0][0].take).toBe(11);
  });

  it("cursor verilirse sayfalama parametreleri eklenir", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    await GET(getReq("?conversationWith=ogrenci-1&cursor=msg-9"));

    const args = prismaMock.message.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "msg-9" });
    expect(args.skip).toBe(1);
  });

  it("gelen okunmamış mesajlar okundu işaretlenir — yalnızca karşı taraftan gelenler", async () => {
    authAs("mentor-1", "MENTOR");
    isMyStudent();

    await GET(getReq("?conversationWith=ogrenci-1"));

    expect(prismaMock.message.updateMany).toHaveBeenCalledWith({
      where: { senderId: "ogrenci-1", receiverId: "mentor-1", isRead: false },
      data: { isRead: true },
    });
  });
});
