import { prisma } from "@/lib/db";

export type CertificateData = {
  id: string;
  studentName: string;
  studentEmail: string;
  mentorName: string | null;
  mentorEmail: string | null;
  certificateNumber: string;
  completionGrade: string;
  mentorNote: string | null;
  issuedAt: string;
  completedProjects: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    track: string[];
    completedStepsCount: number;
    totalStepsCount: number;
  }[];
  verificationUrl: string;
};

/** Benzersiz sertifika seri no üretir: POS-2026-XXXX */
export function generateCertificateNumber(userId: string): string {
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = cleanId.slice(-5).padStart(5, "X");
  const year = new Date().getFullYear();
  return `POS-${year}-${suffix}`;
}

/** Öğrencinin sertifika verilerini derler. */
export async function getStudentCertificate(userId: string): Promise<CertificateData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: {
        include: {
          mentor: {
            select: { id: true, name: true, lastName: true, email: true },
          },
          assignedProjects: {
            include: {
              projectTemplate: true,
              roadmap: {
                include: {
                  steps: {
                    select: { id: true, status: true },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!user || !user.studentProfile) {
    return null;
  }

  const profile = user.studentProfile;
  const certNumber =
    profile.certificateNumber || generateCertificateNumber(user.id);

  const studentName =
    [user.name, user.lastName].filter(Boolean).join(" ") || user.email.split("@")[0];

  const mentorName = profile.mentor
    ? [profile.mentor.name, profile.mentor.lastName].filter(Boolean).join(" ") ||
      profile.mentor.email
    : null;

  const completedProjects = profile.assignedProjects.map((p) => {
    const steps = p.roadmap?.steps || [];
    const totalStepsCount = steps.length;
    const completedStepsCount = steps.filter((s) => s.status === "COMPLETED").length;

    return {
      id: p.id,
      title: p.projectTemplate.title,
      description: p.projectTemplate.description,
      difficulty: p.projectTemplate.difficulty,
      track: p.projectTemplate.track,
      completedStepsCount,
      totalStepsCount,
    };
  });

  const issuedDate = profile.issuedAt
    ? profile.issuedAt.toISOString()
    : new Date().toISOString();

  return {
    id: profile.id,
    studentName,
    studentEmail: user.email,
    mentorName,
    mentorEmail: profile.mentor?.email ?? null,
    certificateNumber: certNumber,
    completionGrade: profile.completionGrade || "Üstün Başarı",
    mentorNote: profile.mentorNote,
    issuedAt: issuedDate,
    completedProjects,
    verificationUrl: `https://posinowa.com/verify-certificate/${certNumber}`,
  };
}

/** Yönetici sertifika bilgilerini (referans notu, başarı derecesi vb.) günceller. */
export async function updateCertificateDetails(
  studentProfileId: string,
  data: {
    certificateNumber?: string;
    mentorNote?: string;
    completionGrade?: string;
    issuedAt?: Date;
  },
) {
  return prisma.studentProfile.update({
    where: { id: studentProfileId },
    data: {
      certificateNumber: data.certificateNumber,
      mentorNote: data.mentorNote,
      completionGrade: data.completionGrade,
      issuedAt: data.issuedAt ?? new Date(),
    },
  });
}
