import { prisma } from "@/lib/db";
import { deleteStepFile } from "@/lib/storage/step-files";
import { ensureCertificateIssued } from "@/features/certificate/server/certificate";
import { logger } from "@/lib/logger";

// Type export
export type UserWithProfile = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  accountStatus: "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED";
  studentProfile?: {
    id: string;
    experienceLevel?: string | null;
    interests: string[];
    // #195: M:N — öğrenciye atanmış mentorlar (0..n).
    mentors: { id: string; name: string | null; lastName: string | null }[];
  } | null;
};

// ------------------------------------
// Tüm kullanıcıları getir
// NOT: Explicit select kullanılır — password hash gibi hassas alanlar
// hiçbir zaman API response'una sızmamalı (include tüm scalar alanları döndürürdü).
export async function getAllUsers(): Promise<UserWithProfile[]> {
  const users = await prisma.user.findMany({
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
          // #195: M:N — atanmış mentorların özet bilgisi (hash sızmaz, sadece seçili alanlar).
          mentorAssignments: {
            select: {
              mentor: { select: { id: true, name: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // mentorAssignments[] → düz mentors[] listesine indir (UI'ın beklediği şekil).
  return users.map((u) => ({
    ...u,
    studentProfile: u.studentProfile
      ? {
          id: u.studentProfile.id,
          experienceLevel: u.studentProfile.experienceLevel,
          interests: u.studentProfile.interests,
          mentors: u.studentProfile.mentorAssignments.map((a) => a.mentor),
        }
      : u.studentProfile,
  }));
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
// Stajyer hesap onay durumunu güncelle (approve/reject/graduated)
export async function updateAccountStatus(
  userId: string,
  accountStatus: "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED",
) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { accountStatus },
    select: { id: true, email: true, name: true, lastName: true, role: true, accountStatus: true },
  });

  // #208 review: Mezun edilen stajyerin sertifikası ANINDA resmileştirilir —
  // seri no + issuedAt DB'ye yazılır. Aksi halde öğrenciye/QR'a türetilmiş ama
  // kayıtlı OLMAYAN bir numara gösterilir ve /verify-certificate "bulunamadı" der.
  if (accountStatus === "GRADUATED") {
    await ensureCertificateIssued(userId);
  }

  return updated;
}

// ------------------------------------
// Kullanıcıyı ve ilişkili tüm verilerini güvenle sil
export async function deleteUser(userId: string, currentAdminId: string) {
  if (userId === currentAdminId) {
    throw new AssignmentValidationError("Kendi hesabınızı silemezsiniz.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });

  if (!targetUser) {
    throw new AssignmentValidationError("Silinecek kullanıcı bulunamadı.");
  }

  // Son admin'in silinmesini engelle
  if (targetUser.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AssignmentValidationError("Sistemdeki son yönetici hesabı silinemez.");
    }
  }

  // #204: DB kaydı cascade ile silinince StepFile satırları da gider ama fiziksel
  // dosyalar (disk/GCS) öksüz kalır. Silmeden ÖNCE etkilenecek dosyaların
  // storedName'lerini topla: (1) bu kullanıcının yüklediği dosyalar + (2) öğrenciyse
  // kendi yol haritası adımlarındaki tüm dosyalar (mentörün yüklediği dahil).
  const orphanFiles = await prisma.stepFile.findMany({
    where: {
      OR: [
        { uploaderId: userId },
        { step: { roadmap: { assignedProject: { studentProfile: { userId } } } } },
      ],
    },
    select: { storedName: true },
  });

  // Prisma cascading deletes Sessions, StudentProfile, Messages, SecurityAnswers, StepFile, etc.
  const deleted = await prisma.user.delete({
    where: { id: userId },
    select: { id: true, email: true, name: true, lastName: true },
  });

  // DB silme başarılı → fiziksel dosyaları best-effort temizle (biri hata verse de
  // kullanıcı silme işlemini başarısız SAYMA; yalnız logla).
  for (const f of orphanFiles) {
    try {
      await deleteStepFile(f.storedName);
    } catch (err) {
      logger.warn("Kullanıcı silinirken öksüz dosya temizlenemedi", {
        storedName: f.storedName,
        err,
      });
    }
  }

  return deleted;
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
// #195: Öğrencinin mentor LİSTESİNİ ayarla (M:N). Gelen liste "olması gereken tam
// küme"dir: listede olmayan atamalar kaldırılır, eksikler eklenir (atomik reconcile).
// Boş liste → tüm mentorlar kaldırılır. Profil yoksa oluşturulur.
// #43: Roller doğrulanır — yalnız STUDENT'a, yalnız MENTOR atanabilir.
export async function setStudentMentors(studentId: string, mentorIds: string[]) {
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

  // Tekrarları ayıkla; her ID gerçekten MENTOR mü tek sorguda doğrula.
  const uniqueMentorIds = [...new Set(mentorIds)];
  if (uniqueMentorIds.length > 0) {
    const mentors = await prisma.user.findMany({
      where: { id: { in: uniqueMentorIds }, role: "MENTOR" },
      select: { id: true },
    });
    if (mentors.length !== uniqueMentorIds.length) {
      throw new AssignmentValidationError(
        "Geçersiz mentor: yalnızca MENTOR rolündeki kullanıcılar atanabilir.",
      );
    }
  }

  // Profil yoksa oluştur (eski assignMentor davranışı korunur).
  const profile = await prisma.studentProfile.upsert({
    where: { userId: studentId },
    update: {},
    create: {
      userId: studentId,
      experienceLevel: "BEGINNER",
      interests: [],
    },
    select: { id: true },
  });

  // Atomik reconcile: listede olmayanları sil + eksikleri ekle.
  await prisma.$transaction([
    prisma.mentorAssignment.deleteMany({
      where: {
        studentProfileId: profile.id,
        // Liste boşsa filtre yok → hepsi silinir (mentor ataması kaldırıldı).
        ...(uniqueMentorIds.length > 0 ? { mentorId: { notIn: uniqueMentorIds } } : {}),
      },
    }),
    prisma.mentorAssignment.createMany({
      data: uniqueMentorIds.map((mentorId) => ({
        studentProfileId: profile.id,
        mentorId,
      })),
      skipDuplicates: true, // aynı mentor tekrar → sessizce atla (@@unique)
    }),
  ]);

  return { studentProfileId: profile.id, mentorIds: uniqueMentorIds };
}
