import { describe, it, expect, beforeEach, vi } from "vitest";

// prisma'yı mock'la (gerçek DB gerekmez)
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    studentProfile: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { assignMentor, AssignmentValidationError } from "./user";

/** user.findUnique için id→rol eşlemesi kuran yardımcı. */
function mockRoles(roles: Record<string, "STUDENT" | "MENTOR" | "ADMIN">) {
  prismaMock.user.findUnique.mockImplementation(
    ({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(roles[id] ? { role: roles[id] } : null),
  );
}

describe("assignMentor — rol doğrulaması (#43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.studentProfile.upsert.mockResolvedValue({ id: "sp-1" });
  });

  it("geçerli STUDENT + MENTOR → upsert çağrılır", async () => {
    mockRoles({ s1: "STUDENT", m1: "MENTOR" });

    await assignMentor("s1", "m1");

    expect(prismaMock.studentProfile.upsert).toHaveBeenCalledOnce();
  });

  it("studentId STUDENT değilse → AssignmentValidationError, upsert yok", async () => {
    mockRoles({ s1: "MENTOR", m1: "MENTOR" });

    await expect(assignMentor("s1", "m1")).rejects.toBeInstanceOf(AssignmentValidationError);
    expect(prismaMock.studentProfile.upsert).not.toHaveBeenCalled();
  });

  it("mentorId MENTOR değilse → AssignmentValidationError, upsert yok", async () => {
    mockRoles({ s1: "STUDENT", m1: "STUDENT" });

    await expect(assignMentor("s1", "m1")).rejects.toBeInstanceOf(AssignmentValidationError);
    expect(prismaMock.studentProfile.upsert).not.toHaveBeenCalled();
  });

  it("öğrenci bulunamazsa → AssignmentValidationError", async () => {
    mockRoles({});

    await expect(assignMentor("yok", "m1")).rejects.toBeInstanceOf(AssignmentValidationError);
  });

  it("mentor bulunamazsa → AssignmentValidationError", async () => {
    mockRoles({ s1: "STUDENT" });

    await expect(assignMentor("s1", "yok")).rejects.toBeInstanceOf(AssignmentValidationError);
  });

  it("mentorId null (atama kaldırma) → mentor kontrolü yok, upsert çağrılır", async () => {
    mockRoles({ s1: "STUDENT" });

    await assignMentor("s1", null);

    // Yalnızca öğrenci için 1 findUnique; mentor sorgusu yapılmaz
    expect(prismaMock.user.findUnique).toHaveBeenCalledOnce();
    expect(prismaMock.studentProfile.upsert).toHaveBeenCalledOnce();
  });
});
