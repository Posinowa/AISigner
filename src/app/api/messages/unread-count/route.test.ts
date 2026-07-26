import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { message: { count: vi.fn() } },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET } from "./route";

describe("messages/unread-count (#158)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("yalnızca oturum sahibine GELEN okunmamışları sayar", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "user-1", role: "STUDENT" } },
    });
    prismaMock.message.count.mockResolvedValue(3);

    const res = await GET();
    const json = await res.json();

    expect(json.unreadCount).toBe(3);
    // Kapsam kritik: başkasının okunmamışları sayılmamalı
    expect(prismaMock.message.count).toHaveBeenCalledWith({
      where: { receiverId: "user-1", isRead: false },
    });
  });

  it("oturum yoksa guard yanıtı döner ve DB'ye gidilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 401 }),
    });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(prismaMock.message.count).not.toHaveBeenCalled();
  });

  it("DB hatası 500'e çevrilir, ham hata sızmaz", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "user-1", role: "STUDENT" } },
    });
    prismaMock.message.count.mockRejectedValue(new Error("connection refused"));

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(json)).not.toContain("connection refused");
  });
});
