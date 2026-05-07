import { prisma } from "@/lib/db";

// Type export
export type UserWithProfile = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  studentProfile?: {
    id: string;
    experienceLevel?: string | null;
    interests: string[];
    mentorId?: string | null;
  } | null;
};

// ------------------------------------
// Tüm kullanıcıları getir
export async function getAllUsers(): Promise<UserWithProfile[]> {
  return prisma.user.findMany({
    include: { studentProfile: true },
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
  return prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

// ------------------------------------
// Öğrenciye mentor atama (profil yoksa otomatik oluştur)
export async function assignMentor(studentId: string, mentorId: string | null) {
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
