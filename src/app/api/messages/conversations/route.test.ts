import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    user: { findMany: vi.fn() },
    studentProfile: { findMany: vi.fn(), findUnique: vi.fn() },
    message: { findFirst: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET } from "./route";

function authAs(id: string, role: "MENTOR" | "STUDENT" | "ADMIN") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id, role } },
  });
}

const admin = { id: "admin-1", name: "Yönetici", lastName: null, role: "ADMIN" };

describe("messages/conversations (#158)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.message.findFirst.mockResolvedValue(null);
    prismaMock.message.count.mockResolvedValue(0);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.studentProfile.findMany.mockResolvedValue([]);
    prismaMock.studentProfile.findUnique.mockResolvedValue(null);
  });

  it("MENTOR yalnızca KENDİ öğrencilerini listeler", async () => {
    authAs("mentor-1", "MENTOR");
    prismaMock.studentProfile.findMany.mockResolvedValue([
      { user: { id: "ogrenci-1", name: "Ali", lastName: "Veli", role: "STUDENT" } },
    ]);

    const res = await GET();
    const json = await res.json();

    // Kapsam kritik: sorgu mentorId ile sınırlanmalı
    expect(prismaMock.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { mentorId: "mentor-1" } }),
    );
    expect(res.status).toBe(200);
    expect(json.conversations.map((c: { partner: { id: string } }) => c.partner.id)).toContain(
      "ogrenci-1",
    );
  });

  it("STUDENT yalnızca kendi mentörünü görür", async () => {
    authAs("ogrenci-1", "STUDENT");
    prismaMock.studentProfile.findUnique.mockResolvedValue({
      mentor: { id: "mentor-1", name: "Ayşe", lastName: null, role: "MENTOR" },
    });

    const res = await GET();
    const json = await res.json();

    expect(prismaMock.studentProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "ogrenci-1" } }),
    );
    expect(json.conversations.map((c: { partner: { id: string } }) => c.partner.id)).toEqual([
      "mentor-1",
    ]);
  });

  it("mentörü atanmamış öğrenci yalnızca yöneticileri görür", async () => {
    authAs("ogrenci-1", "STUDENT");
    prismaMock.studentProfile.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([admin]);

    const json = await (await GET()).json();

    expect(json.conversations.map((c: { partner: { id: string } }) => c.partner.id)).toEqual([
      "admin-1",
    ]);
  });

  it("ADMIN kendisi hariç tüm kullanıcıları listeler", async () => {
    authAs("admin-1", "ADMIN");
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u2", name: "Ali", lastName: null, role: "STUDENT" },
    ]);

    await GET();

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { not: "admin-1" } } }),
    );
  });

  it("konuşmalar son mesaja göre yeniden eskiye sıralanır", async () => {
    authAs("mentor-1", "MENTOR");
    prismaMock.studentProfile.findMany.mockResolvedValue([
      { user: { id: "eski", name: "Eski", lastName: null, role: "STUDENT" } },
      { user: { id: "yeni", name: "Yeni", lastName: null, role: "STUDENT" } },
    ]);
    prismaMock.message.findFirst
      .mockResolvedValueOnce({ id: "m1", content: "a", senderId: "eski", createdAt: new Date("2026-01-01"), isRead: true })
      .mockResolvedValueOnce({ id: "m2", content: "b", senderId: "yeni", createdAt: new Date("2026-06-01"), isRead: true });

    const json = await (await GET()).json();

    expect(json.conversations[0].partner.id).toBe("yeni");
  });

  it("hiç mesajı olmayan konuşmalar listenin sonuna düşer", async () => {
    authAs("mentor-1", "MENTOR");
    prismaMock.studentProfile.findMany.mockResolvedValue([
      { user: { id: "bos", name: "Bos", lastName: null, role: "STUDENT" } },
      { user: { id: "dolu", name: "Dolu", lastName: null, role: "STUDENT" } },
    ]);
    prismaMock.message.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "m1", content: "a", senderId: "dolu", createdAt: new Date("2026-06-01"), isRead: false });

    const json = await (await GET()).json();

    expect(json.conversations[0].partner.id).toBe("dolu");
    expect(json.conversations[1].partner.id).toBe("bos");
  });

  it("okunmamış sayısı yalnızca karşı taraftan gelenleri kapsar", async () => {
    authAs("mentor-1", "MENTOR");
    prismaMock.studentProfile.findMany.mockResolvedValue([
      { user: { id: "ogrenci-1", name: "Ali", lastName: null, role: "STUDENT" } },
    ]);

    await GET();

    expect(prismaMock.message.count).toHaveBeenCalledWith({
      where: { senderId: "ogrenci-1", receiverId: "mentor-1", isRead: false },
    });
  });

  it("yetkisiz istekte DB'ye hiç gidilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 401 }),
    });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(prismaMock.studentProfile.findMany).not.toHaveBeenCalled();
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });
});
