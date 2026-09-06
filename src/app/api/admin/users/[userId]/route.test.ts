// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockDeleteUser } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockDeleteUser: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/features/admin/server/user", () => ({
  deleteUser: mockDeleteUser,
  AssignmentValidationError: class AssignmentValidationError extends Error {},
}));

import { DELETE } from "./route";
import { AssignmentValidationError } from "@/features/admin/server/user";

describe("DELETE /api/admin/users/[userId] — Güvenli Kullanıcı Silme API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yetkisiz kullanıcı (oturum yok veya admin değil) → 401/403 döner", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const req = new Request("http://localhost/api/admin/users/target-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ userId: "target-1" }) });

    expect(res.status).toBe(401);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("admin kendi hesabını veya son admini silmeye çalışırsa → 400 validation error", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "admin-1", role: "ADMIN" } },
    });
    mockDeleteUser.mockRejectedValue(new AssignmentValidationError("Kendi hesabınızı silemezsiniz."));

    const req = new Request("http://localhost/api/admin/users/admin-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ userId: "admin-1" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Kendi hesabınızı silemezsiniz.");
  });

  it("başarılı silme → 200 döner ve silinen kullanıcı bilgisini iletir", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      session: { user: { id: "admin-1", role: "ADMIN" } },
    });
    mockDeleteUser.mockResolvedValue({
      id: "student-1",
      email: "student@test.com",
      name: "Ali",
    });

    const req = new Request("http://localhost/api/admin/users/student-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ userId: "student-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.id).toBe("student-1");
  });
});
