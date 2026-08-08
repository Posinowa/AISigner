import { describe, it, expect, beforeEach, vi } from "vitest";

// prisma'yı mock'la (gerçek DB gerekmez)
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    studentProfile: { upsert: vi.fn() },
    mentorAssignment: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  setStudentMentors,
  updateAccountStatus,
  deleteUser,
  AssignmentValidationError,
} from "./user";

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

describe("updateAccountStatus — stajyer onay, mezuniyet ve red durumları", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GRADUATED durumu başarıyla güncellenir", async () => {
    prismaMock.user.update.mockResolvedValue({
      id: "u-1",
      email: "student@test.com",
      name: "Ali",
      lastName: "Veli",
      role: "STUDENT",
      accountStatus: "GRADUATED",
    });

    const result = await updateAccountStatus("u-1", "GRADUATED");

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: { accountStatus: "GRADUATED" },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        role: true,
        accountStatus: true,
      },
    });
    expect(result.accountStatus).toBe("GRADUATED");
  });
});

describe("deleteUser — güvenli hesap silme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin kendi hesabını silmeye çalışırsa hata fırlatır", async () => {
    await expect(deleteUser("admin-1", "admin-1")).rejects.toThrow(
      "Kendi hesabınızı silemezsiniz.",
    );
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("silinecek kullanıcı bulunamazsa hata fırlatır", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(deleteUser("not-found", "admin-1")).rejects.toThrow(
      "Silinecek kullanıcı bulunamadı.",
    );
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("sistemdeki tek admin silinmeye çalışılırsa hata fırlatır", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin-2",
      role: "ADMIN",
      email: "admin2@test.com",
    });
    prismaMock.user.count.mockResolvedValue(1);

    await expect(deleteUser("admin-2", "admin-1")).rejects.toThrow(
      "Sistemdeki son yönetici hesabı silinemez.",
    );
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("öğrenci veya mentor hesabı başarıyla silinir", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "student-1",
      role: "STUDENT",
      email: "student1@test.com",
    });
    prismaMock.user.delete.mockResolvedValue({
      id: "student-1",
      email: "student1@test.com",
      name: "Ahmet",
      lastName: "Yılmaz",
    });

    const deleted = await deleteUser("student-1", "admin-1");

    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: "student-1" },
      select: { id: true, email: true, name: true, lastName: true },
    });
    expect(deleted.id).toBe("student-1");
  });
});
