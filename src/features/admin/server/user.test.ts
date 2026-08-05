import { describe, it, expect, beforeEach, vi } from "vitest";

// prisma'yı mock'la (gerçek DB gerekmez)
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    studentProfile: { upsert: vi.fn() },
    mentorAssignment: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { setStudentMentors, AssignmentValidationError } from "./user";

// #195: assignMentor (tek mentor) → setStudentMentors (M:N liste reconcile).
describe("setStudentMentors — rol doğrulaması + M:N reconcile (#43/#195)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.studentProfile.upsert.mockResolvedValue({ id: "sp-1" });
    prismaMock.mentorAssignment.deleteMany.mockReturnValue("del-op");
    prismaMock.mentorAssignment.createMany.mockReturnValue("create-op");
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it("geçerli STUDENT + MENTOR listesi → reconcile ($transaction) çağrılır", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });
    prismaMock.user.findMany.mockResolvedValue([{ id: "m1" }]);

    await setStudentMentors("s1", ["m1"]);

    expect(prismaMock.studentProfile.upsert).toHaveBeenCalledOnce();
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("studentId STUDENT değilse → hata, reconcile yok", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "MENTOR" });

    await expect(setStudentMentors("s1", ["m1"])).rejects.toBeInstanceOf(AssignmentValidationError);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("listedeki id MENTOR değilse → hata, reconcile yok", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });
    prismaMock.user.findMany.mockResolvedValue([]); // m1 MENTOR değil → doğrulama düşer

    await expect(setStudentMentors("s1", ["m1"])).rejects.toBeInstanceOf(AssignmentValidationError);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("öğrenci bulunamazsa → hata", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(setStudentMentors("yok", ["m1"])).rejects.toBeInstanceOf(AssignmentValidationError);
  });

  it("boş liste (tüm mentorları kaldır) → mentor doğrulaması yok, reconcile çağrılır", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });

    await setStudentMentors("s1", []);

    // Boş listede MENTOR-rol sorgusu (findMany) YAPILMAZ.
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("aynı mentor iki kez verilse → tekilleştirilir", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });
    prismaMock.user.findMany.mockResolvedValue([{ id: "m1" }]);

    await setStudentMentors("s1", ["m1", "m1"]);

    const arg = prismaMock.user.findMany.mock.calls[0][0] as { where: { id: { in: string[] } } };
    expect(arg.where.id.in).toEqual(["m1"]);
  });
});
