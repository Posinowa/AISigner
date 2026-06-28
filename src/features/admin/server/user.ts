import { prisma } from "@/lib/db";

// Type export
export type UserWithProfile = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  accountStatus: "PENDING" | "APPROVED" | "REJECTED";
  studentProfile?: {
    id: string;
    experienceLevel?: string | null;
    interests: string[];
    mentorId?: string | null;
  } | null;
};

// ------------------------------------
// Tüm kullanıcıları getir
// NOT: Explicit select kullanılır — password hash gibi hassas alanlar
// hiçbir zaman API response'una sızmamalı (include tüm scalar alanları döndürürdü).
export async function getAllUsers(): Promise<UserWithProfile[]> {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      lastName: true,
      role: true,
      accountStatus: true,
      studentProfile: {
        select: {
          id: true,
          experienceLevel: true,
          interests: true,
          mentorId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ------------------------------------
// Sadece mentorları getir
export async function getMentors(): Promise<{id: string; name: string | null; lastName: string | null; email: string;}[]> {
  return prisma.user.findMany({
    where: { role: "MENTOR" },
    select: { id: true, name: true, lastName: true, email: true },
  });
}

// ------------------------------------
// Kullanıcı rolünü güncelle
export async function updateUserRole(userId: string, role: "ADMIN" | "MENTOR" | "STUDENT") {
  // Güvenli response shape — password hash döndürülmez.
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, name: true, lastName: true, role: true },
  });
}

// ------------------------------------
// Stajyer hesap onay durumunu güncelle (approve/reject)
export async function updateAccountStatus(
  userId: string,
  accountStatus: "PENDING" | "APPROVED" | "REJECTED",
) {
  return prisma.user.update({
    where: { id: userId },
    data: { accountStatus },
    select: { id: true, email: true, name: true, lastName: true, role: true, accountStatus: true },
  });
}

// ------------------------------------
// Mentor atama doğrulama hatası — route bunu 4xx'e çevirir (DB hatası 500 ile karışmasın).
export class AssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignmentValidationError";
  }
}

// ------------------------------------
// Öğrenciye mentor atama (profil yoksa otomatik oluştur)
// #43: Rolleri doğrula — yalnızca STUDENT'a, yalnızca MENTOR atanabilir.
export async function assignMentor(studentId: string, mentorId: string | null) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { role: true },
  });
  if (!student) {
    throw new AssignmentValidationError("Öğrenci bulunamadı.");
  }
  if (student.role !== "STUDENT") {
    throw new AssignmentValidationError(
      "Mentor yalnızca STUDENT rolündeki kullanıcıya atanabilir.",
    );
  }

  // mentorId null → atamayı kaldır (rol kontrolü gerekmez)
  if (mentorId !== null) {
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      select: { role: true },
    });
    if (!mentor) {
      throw new AssignmentValidationError("Mentor bulunamadı.");
    }
    if (mentor.role !== "MENTOR") {
      throw new AssignmentValidationError(
        "Yalnızca MENTOR rolündeki kullanıcı mentor olarak atanabilir.",
      );
    }
  }

  return prisma.studentProfile.upsert({
    where: { userId: studentId },
    update: { mentorId },
    create: {
      userId: studentId,
      mentorId,
      experienceLevel: "BEGINNER",
      interests: [],
    },
  });
}
