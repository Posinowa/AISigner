import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { assignedProject: { findMany: vi.fn() } },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getStudentAssignmentsProgress } from "./assignment-progress";

describe("getStudentAssignmentsProgress — yetki (#178-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.assignedProject.findMany.mockResolvedValue([]);
  });

  it("ADMIN rolü guard'a geçirilir", async () => {
    requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "a", role: "ADMIN" } } });

    await getStudentAssignmentsProgress();

    expect(requireAuthMock).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("yetkisizse hata fırlatır ve DB'ye HİÇ gidilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    await expect(getStudentAssignmentsProgress()).rejects.toThrow();
    expect(prismaMock.assignedProject.findMany).not.toHaveBeenCalled();
  });

  it("yetkiliyse veriyi döndürür", async () => {
    requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "a", role: "ADMIN" } } });
    prismaMock.assignedProject.findMany.mockResolvedValue([]);

    const res = await getStudentAssignmentsProgress();

    expect(Array.isArray(res)).toBe(true);
    expect(prismaMock.assignedProject.findMany).toHaveBeenCalled();
  });
});
