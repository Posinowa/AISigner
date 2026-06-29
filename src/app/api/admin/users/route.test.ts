import { describe, it, expect, beforeEach, vi } from "vitest";

// requireAuth + prisma mock'lanır; assignMentor GERÇEK çalışır (uçtan uca 400/200 doğrulaması).
const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    user: { findUnique: vi.fn() },
    studentProfile: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

function authAsAdmin() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "admin-1", role: "ADMIN" } },
  });
}

function mockRoles(roles: Record<string, "STUDENT" | "MENTOR" | "ADMIN">) {
  prismaMock.user.findUnique.mockImplementation(
    ({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(roles[id] ? { role: roles[id] } : null),
  );
}

function postReq(body: unknown) {
  return new Request("http://test/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/users — mentor atama rol doğrulaması (#43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.studentProfile.upsert.mockResolvedValue({ id: "sp-1" });
  });

  it("admin değilse requireAuth yanıtını döner (403)", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 403 }),
    });

    const res = await POST(postReq({ studentId: "s1", mentorId: "m1" }));
    expect(res.status).toBe(403);
  });

  it("geçerli STUDENT + MENTOR → 200, upsert çağrılır", async () => {
    authAsAdmin();
    mockRoles({ s1: "STUDENT", m1: "MENTOR" });

    const res = await POST(postReq({ studentId: "s1", mentorId: "m1" }));

    expect(res.status).toBe(200);
    expect(prismaMock.studentProfile.upsert).toHaveBeenCalledOnce();
  });

  it("studentId STUDENT değilse → 400 + anlamlı mesaj, upsert yok", async () => {
    authAsAdmin();
    mockRoles({ s1: "MENTOR", m1: "MENTOR" });

    const res = await POST(postReq({ studentId: "s1", mentorId: "m1" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
    expect(prismaMock.studentProfile.upsert).not.toHaveBeenCalled();
  });

  it("mentorId MENTOR değilse → 400, upsert yok", async () => {
    authAsAdmin();
    mockRoles({ s1: "STUDENT", m1: "STUDENT" });

    const res = await POST(postReq({ studentId: "s1", mentorId: "m1" }));

    expect(res.status).toBe(400);
    expect(prismaMock.studentProfile.upsert).not.toHaveBeenCalled();
  });

  it("mentorId null (atama kaldırma) → 200", async () => {
    authAsAdmin();
    mockRoles({ s1: "STUDENT" });

    const res = await POST(postReq({ studentId: "s1", mentorId: null }));

    expect(res.status).toBe(200);
    expect(prismaMock.studentProfile.upsert).toHaveBeenCalledOnce();
  });

  it("eksik studentId → 400 (zod validation)", async () => {
    authAsAdmin();

    const res = await POST(postReq({ mentorId: "m1" }));
    expect(res.status).toBe(400);
  });
});
