import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    user: { findMany: vi.fn() },
    studentProfile: { findMany: vi.fn(), findUnique: vi.fn() },
    message: { groupBy: vi.fn() },
    $queryRaw: vi.fn(),
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
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.message.groupBy.mockResolvedValue([]);
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

    // Kapsam kritik: sorgu bu mentörün öğrencileriyle sınırlanmalı.
    // #370: bağ İKİ YOLDAN gelir — bireysel atama VEYA takım mentörlüğü.
    // Yalnız bireysel dal varken takım üyesi listede HİÇ görünmüyordu.
    const nerede = prismaMock.studentProfile.findMany.mock.calls[0][0].where;
    expect(nerede.OR[0].mentorAssignments.some.mentorId).toBe("mentor-1");
    expect(nerede.OR[1].teamMemberships.some.team.mentors.some.mentorId).toBe("mentor-1");
    expect(nerede.OR[1].teamMemberships.some.leftAt).toBeNull();
    expect(res.status).toBe(200);
    expect(json.conversations.map((c: { partner: { id: string } }) => c.partner.id)).toContain(
      "ogrenci-1",
    );
  });

  it("STUDENT yalnızca kendi mentörünü görür", async () => {
    authAs("ogrenci-1", "STUDENT");
    // #195: M:N — öğrencinin mentorları mentorAssignments üzerinden gelir.
    prismaMock.studentProfile.findUnique.mockResolvedValue({
      mentorAssignments: [
        { mentor: { id: "mentor-1", name: "Ayşe", lastName: null, role: "MENTOR" } },
      ],
      // #370: Takım mentörleri de konuşma partneri.
      teamMemberships: [],
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
    prismaMock.$queryRaw.mockResolvedValue([
      { partnerId: "eski", id: "m1", content: "a", senderId: "eski", createdAt: new Date("2026-01-01"), isRead: true },
      { partnerId: "yeni", id: "m2", content: "b", senderId: "yeni", createdAt: new Date("2026-06-01"), isRead: true },
    ]);

    const json = await (await GET()).json();

    expect(json.conversations[0].partner.id).toBe("yeni");
  });

  it("hiç mesajı olmayan konuşmalar listenin sonuna düşer", async () => {
    authAs("mentor-1", "MENTOR");
    prismaMock.studentProfile.findMany.mockResolvedValue([
      { user: { id: "bos", name: "Bos", lastName: null, role: "STUDENT" } },
      { user: { id: "dolu", name: "Dolu", lastName: null, role: "STUDENT" } },
    ]);
    // "bos" için satır YOK — DISTINCT ON yalnız mesajı olan partnerleri döndürür.
    prismaMock.$queryRaw.mockResolvedValue([
      { partnerId: "dolu", id: "m1", content: "a", senderId: "dolu", createdAt: new Date("2026-06-01"), isRead: false },
    ]);

    const json = await (await GET()).json();

    expect(json.conversations[0].partner.id).toBe("dolu");
    expect(json.conversations[1].partner.id).toBe("bos");
  });

  it("okunmamış sayısı yalnızca karşı taraftan gelenleri kapsar", async () => {
    authAs("mentor-1", "MENTOR");
    prismaMock.studentProfile.findMany.mockResolvedValue([
      { user: { id: "ogrenci-1", name: "Ali", lastName: null, role: "STUDENT" } },
    ]);
    prismaMock.message.groupBy.mockResolvedValue([
      { senderId: "ogrenci-1", _count: { _all: 3 } },
    ]);

    const json = await (await GET()).json();

    expect(prismaMock.message.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["senderId"],
        where: expect.objectContaining({ receiverId: "mentor-1", isRead: false }),
      }),
    );
    expect(json.conversations[0].unreadCount).toBe(3);
  });

  // REGRESYON: bu uç partner başına 2 sorgu atıyordu. ADMIN için partner listesi
  // TÜM kullanıcılar olduğundan 500 kullanıcı = 1000 eşzamanlı sorgu demekti ve
  // Prisma bağlantı havuzunu tıkıyordu. Sorgu sayısı partner sayısından BAĞIMSIZ
  // olmalı — aksi halde N+1 sessizce geri gelir.
  it("sorgu sayısı partner sayısıyla BÜYÜMEZ", async () => {
    authAs("admin-1", "ADMIN");
    prismaMock.user.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({
        id: `u${i}`,
        name: `K${i}`,
        lastName: null,
        role: "STUDENT",
      })),
    );

    const json = await (await GET()).json();

    expect(json.conversations).toHaveLength(50);
    // 50 partner → yine tek $queryRaw + tek groupBy.
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.groupBy).toHaveBeenCalledTimes(1);
  });

  it("hiç partner yoksa mesaj sorgusu HİÇ atılmaz", async () => {
    authAs("ogrenci-1", "STUDENT");
    prismaMock.studentProfile.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([]);

    await GET();

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.message.groupBy).not.toHaveBeenCalled();
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
