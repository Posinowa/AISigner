import { describe, it, expect, beforeEach, vi } from "vitest";

// requireAuth + prisma mock'lanır; setStudentMentors GERÇEK çalışır (uçtan uca 400/200).
const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    studentProfile: { upsert: vi.fn() },
    mentorAssignment: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
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

// findUnique → öğrenci rolü; findMany → verilen id'lerden MENTOR olanlar (#195 doğrulama).
function mockRoles(roles: Record<string, "STUDENT" | "MENTOR" | "ADMIN">) {
  prismaMock.user.findUnique.mockImplementation(
    ({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(roles[id] ? { role: roles[id] } : null),
  );
  prismaMock.user.findMany.mockImplementation(
    ({ where: { id } }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(id.in.filter((i) => roles[i] === "MENTOR").map((i) => ({ id: i }))),
  );
}

function postReq(body: unknown) {
  return new Request("http://test/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/users — mentor atama rol doğrulaması (#43/#195)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.studentProfile.upsert.mockResolvedValue({ id: "sp-1" });
    prismaMock.mentorAssignment.deleteMany.mockReturnValue("del-op");
    prismaMock.mentorAssignment.createMany.mockReturnValue("create-op");
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it("admin değilse requireAuth yanıtını döner (403)", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 403 }),
    });

    const res = await POST(postReq({ studentId: "s1", mentorIds: ["m1"] }));
    expect(res.status).toBe(403);
  });

  it("geçerli STUDENT + MENTOR listesi → 200, reconcile çağrılır", async () => {
    authAsAdmin();
    mockRoles({ s1: "STUDENT", m1: "MENTOR" });

    const res = await POST(postReq({ studentId: "s1", mentorIds: ["m1"] }));

    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("studentId STUDENT değilse → 400 + anlamlı mesaj, reconcile yok", async () => {
    authAsAdmin();
    mockRoles({ s1: "MENTOR", m1: "MENTOR" });

    const res = await POST(postReq({ studentId: "s1", mentorIds: ["m1"] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("listedeki id MENTOR değilse → 400, reconcile yok", async () => {
    authAsAdmin();
    mockRoles({ s1: "STUDENT", m1: "STUDENT" });

    const res = await POST(postReq({ studentId: "s1", mentorIds: ["m1"] }));

    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("boş liste (tüm mentorları kaldır) → 200", async () => {
    authAsAdmin();
    mockRoles({ s1: "STUDENT" });

    const res = await POST(postReq({ studentId: "s1", mentorIds: [] }));

    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("eksik studentId → 400 (zod validation)", async () => {
    authAsAdmin();

    const res = await POST(postReq({ mentorIds: ["m1"] }));
    expect(res.status).toBe(400);
  });
});
