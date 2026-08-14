import { prisma } from "@/lib/db";

export type CertificateData = {
  id: string;
  studentName: string;
  studentEmail: string;
  mentorName: string | null;
  mentorEmail: string | null;
  certificateNumber: string;
  completionGrade: string | null;
  mentorNote: string | null;
  issuedAt: string | null;
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
  /**
   * #208 review: Sertifika RESMİ olarak yayınlandı mı (seri no + issuedAt DB'de kayıtlı)?
   * false ise `certificateNumber`/`verificationUrl` yalnızca ÖNİZLEME'dir — o numarayla
   * `/verify-certificate` sorgusu "bulunamadı" döner, çünkü DB'de kayıtlı değildir.
   */
  isIssued: boolean;
};

export type PublicCertificateVerification = {
  isValid: boolean;
  certificate?: {
    certificateNumber: string;
    studentName: string;
    issuedAt: string | null;
    completionGrade: string | null;
    mentorName: string | null;
    completedProjects: {
      id: string;
      title: string;
      difficulty: string;
      track: string[];
      completedStepsCount: number;
      totalStepsCount: number;
    }[];
  };
  message?: string;
};

/** Benzersiz sertifika seri no üretir: POS-2026-XXXX */
export function generateCertificateNumber(userId: string): string {
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = cleanId.slice(-5).padStart(5, "X");
  const year = new Date().getFullYear();
  return `POS-${year}-${suffix}`;
}

/** Doğrulama URL'i üretir. */
export function getCertificateVerificationUrl(certNumber: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://posinowa.com").replace(/\/+$/, "");
  return `${baseUrl}/verify-certificate/${encodeURIComponent(certNumber)}`;
}

/** Öğrencinin sertifika verilerini derler. */
export async function getStudentCertificate(userId: string): Promise<CertificateData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: {
        include: {
          // #195: M:N — öğrencinin mentorları join tablosu üzerinden.
          mentorAssignments: {
            include: {
              mentor: {
                select: { id: true, name: true, lastName: true, email: true },
              },
            },
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

  // #195: M:N — sertifikada tüm atanmış mentorlar gösterilir.
  const mentorsList = profile.mentorAssignments.map((a) => a.mentor);
  const mentorName =
    mentorsList.length > 0
      ? mentorsList
          .map((m) => [m.name, m.lastName].filter(Boolean).join(" ") || m.email)
          .join(", ")
      : null;
  const mentorEmail = mentorsList[0]?.email ?? null;

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
    : null;

  // #208 review: Belge ancak seri no VE issuedAt DB'de kayıtlıysa resmidir.
  // Aksi halde (admin önizlemesi) numara türetilmiştir ve doğrulama sorgusu bulamaz.
  const isIssued = Boolean(profile.certificateNumber && profile.issuedAt);

  return {
    id: profile.id,
    studentName,
    studentEmail: user.email,
    mentorName,
    mentorEmail,
    certificateNumber: certNumber,
    completionGrade: profile.completionGrade ?? null,
    mentorNote: profile.mentorNote,
    issuedAt: issuedDate,
    completedProjects,
    verificationUrl: getCertificateVerificationUrl(certNumber),
    isIssued,
  };
}

/**
 * #208 review: Sertifikayı RESMİLEŞTİR — seri no ve düzenlenme tarihini KALICI yazar.
 *
 * Mezuniyet anında çağrılır. Böylece öğrenciye/QR'a gösterilen numara DB'de kayıtlı
 * olur ve public `/verify-certificate/<no>` sorgusu belgeyi bulur. İdempotent: zaten
 * kayıtlı alanlara dokunmaz (yeniden mezun etme numarayı değiştirmez).
 */
export async function ensureCertificateIssued(userId: string): Promise<void> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true, certificateNumber: true, issuedAt: true },
  });

  // Profil yoksa yapacak bir şey yok (sertifika profile bağlı).
  if (!profile) return;
  if (profile.certificateNumber && profile.issuedAt) return;

  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      certificateNumber: profile.certificateNumber ?? generateCertificateNumber(userId),
      issuedAt: profile.issuedAt ?? new Date(),
    },
  });
}

/** Yönetici sertifika bilgilerini (referans notu, başarı derecesi vb.) günceller. */
export async function updateCertificateDetails(
  studentProfileId: string,
  data: {
    certificateNumber?: string;
    mentorNote?: string | null;
    completionGrade?: string | null;
    issuedAt?: Date | null;
  },
) {
  return prisma.studentProfile.update({
    where: { id: studentProfileId },
    data: {
      certificateNumber: data.certificateNumber,
      mentorNote: data.mentorNote,
      completionGrade: data.completionGrade,
      issuedAt: data.issuedAt !== undefined ? data.issuedAt : new Date(),
    },
  });
}

/** #208: Kamu / 3. taraf sertifika doğrulama sorgusu. */
export async function verifyCertificate(
  certificateNumber: string,
): Promise<PublicCertificateVerification> {
  const trimmedNumber = certificateNumber.trim();
  if (!trimmedNumber) {
    return { isValid: false, message: "Geçersiz sertifika numarası." };
  }

  const profile = await prisma.studentProfile.findFirst({
    where: {
      certificateNumber: {
        equals: trimmedNumber,
        mode: "insensitive",
      },
    },
    include: {
      user: {
        // #208: Public sayfa — email/PII ÇEKİLMEZ (name yoksa nötr etikete düşülür).
        select: {
          id: true,
          name: true,
          lastName: true,
          accountStatus: true,
        },
      },
      mentorAssignments: {
        include: {
          mentor: {
            select: { name: true, lastName: true },
          },
        },
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
  });

  if (!profile || !profile.user) {
    return {
      isValid: false,
      message: "Bu seri numarasına ait kayıtlı sertifika bulunamadı.",
    };
  }

  // Yalnızca mezun edilmiş veya resmi issuedAt tarihi bulunan belgeler geçerlidir.
  const isOfficiallyIssued =
    profile.user.accountStatus === "GRADUATED" || profile.issuedAt !== null;

  if (!isOfficiallyIssued) {
    return {
      isValid: false,
      message: "Bu sertifika henüz resmi olarak onaylanmamış veya yayınlanmamıştır.",
    };
  }

  // #208: Public sayfada isim yoksa email'e DÜŞÜLMEZ (PII sızıntısı) — nötr etiket.
  const studentName =
    [profile.user.name, profile.user.lastName].filter(Boolean).join(" ") ||
    "İsimsiz Stajyer";

  const mentorsList = profile.mentorAssignments.map((a) => a.mentor);
  const mentorName =
    mentorsList.length > 0
      ? mentorsList
          .map((m) => [m.name, m.lastName].filter(Boolean).join(" ") || "Mentör")
          .join(", ")
      : null;

  const completedProjects = profile.assignedProjects.map((p) => {
    const steps = p.roadmap?.steps || [];
    const totalStepsCount = steps.length;
    const completedStepsCount = steps.filter((s) => s.status === "COMPLETED").length;

    return {
      id: p.id,
      title: p.projectTemplate.title,
      difficulty: p.projectTemplate.difficulty,
      track: p.projectTemplate.track,
      completedStepsCount,
      totalStepsCount,
    };
  });

  return {
    isValid: true,
    certificate: {
      certificateNumber: profile.certificateNumber || trimmedNumber,
      studentName,
      issuedAt: profile.issuedAt ? profile.issuedAt.toISOString() : null,
      completionGrade: profile.completionGrade ?? null,
      mentorName,
      completedProjects,
    },
  };
}

