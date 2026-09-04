import { prisma } from "@/lib/db";
import { uygulamaUrl } from "@/lib/app-url";
import { logger } from "@/lib/logger";
import { sertifikaKapsaminiGetir } from "./katki";

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
    /** #449: TAKIM projesinde bu sayı ÖĞRENCİNİN KENDİ katkısıdır. */
    completedStepsCount: number;
    totalStepsCount: number;
    /** #449: Doluysa TAKIM projesi — belgede bireysel işmiş gibi durmamalı. */
    takimAdi: string | null;
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
      /** #449: TAKIM projesinde bu sayı ÖĞRENCİNİN KENDİ katkısıdır. */
      completedStepsCount: number;
      totalStepsCount: number;
      /** #449: Doluysa TAKIM projesi. */
      takimAdi: string | null;
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

/** #208 review: Seri no çakışmasında kaç kez yeniden denenecek. */
const MAX_CERT_NUMBER_ATTEMPTS = 5;

/** Çakışma durumunda kullanılan tamamen rastgele seri no (aynı POS-YYYY-XXXXX formatı). */
function generateRandomCertificateNumber(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `POS-${new Date().getFullYear()}-${suffix}`;
}

/** Prisma unique-constraint (P2002) ihlali mi? */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/** Doğrulama URL'i üretir. */
export function getCertificateVerificationUrl(certNumber: string): string {
  const baseUrl = uygulamaUrl();
  return `${baseUrl}/verify-certificate/${encodeURIComponent(certNumber)}`;
}

/** Öğrencinin sertifika verilerini derler. */
export async function getStudentCertificate(userId: string): Promise<CertificateData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    // #449: Projeler ve mentörler ARTIK BURADAN GELMİYOR. İkisi de takım
    // yolunu atlıyordu (takım atamasında `studentProfileId` NULL, takım
    // mentörü `TeamMentor`'da) ve aynı körlük `verifyCertificate`'te de
    // vardı. Tek kaynak: `katki.ts`.
    include: { studentProfile: true },
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
  // #449: Takım mentörleri de dahil (tek kaynak: `katki.ts`).
  const { projeler, mentorler } = await sertifikaKapsaminiGetir(profile.id, user.id, {
    epostaDahil: true,
  });

  const mentorName =
    mentorler.length > 0
      ? mentorler
          .map((m) => [m.name, m.lastName].filter(Boolean).join(" ") || m.email || "Mentör")
          .join(", ")
      : null;
  const mentorEmail = mentorler[0]?.email ?? null;

  const completedProjects = projeler;

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

  // Seri no zaten varsa yalnız tarihi tamamla (numara ASLA değiştirilmez).
  if (profile.certificateNumber) {
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: { issuedAt: profile.issuedAt ?? new Date() },
    });
    return;
  }

  // #208 review: `certificateNumber` artık @unique. Seri no userId'nin son 5
  // karakterinden türediği için nadir de olsa çakışabilir → unique ihlalinde (P2002)
  // yeni bir aday üretip sınırlı sayıda yeniden dene.
  for (let attempt = 0; attempt < MAX_CERT_NUMBER_ATTEMPTS; attempt++) {
    const candidate =
      attempt === 0 ? generateCertificateNumber(userId) : generateRandomCertificateNumber();
    try {
      await prisma.studentProfile.update({
        where: { id: profile.id },
        data: { certificateNumber: candidate, issuedAt: profile.issuedAt ?? new Date() },
      });
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      logger.warn("Sertifika seri no çakıştı, yeniden üretiliyor", { userId, attempt });
    }
  }

  throw new Error("Benzersiz sertifika numarası üretilemedi (çakışma sınırı aşıldı).");
}

/**
 * Yönetici sertifika bilgilerini (referans notu, başarı derecesi vb.) günceller.
 *
 * #208 review (P3 tuzağı): Eskiden `issuedAt` verilmediğinde otomatik `new Date()`
 * yazılıyordu — yani admin sadece NOT kaydettiğinde, mezun olmayan öğrencinin belgesi
 * public doğrulamada "geçerli" hale geliyordu (`GRADUATED || issuedAt`). Artık
 * `issuedAt` YALNIZCA açıkça gönderildiğinde değişir; belge resmileştirme tek bir
 * yerde olur: mezuniyet → `ensureCertificateIssued()`.
 */
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
      // undefined → Prisma alanı DEĞİŞTİRMEZ (otomatik yayınlama yok).
      issuedAt: data.issuedAt,
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
      // #449: Projeler ve mentörler `katki.ts`'ten — takım yolu buradan
      // atlanıyordu ve belge boş çıkıyordu.
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

  // #449: Takım mentörleri ve takım projeleri de dahil.
  // ⚠️ `epostaDahil: false` — #208'de public yüzeyde PII'nin sorguya HİÇ
  // girmemesi kararlaştırılmıştı (yanıttan ayıklamak değil, çekmemek).
  const { projeler, mentorler } = await sertifikaKapsaminiGetir(profile.id, profile.user.id, {
    epostaDahil: false,
  });

  const mentorName =
    mentorler.length > 0
      ? mentorler
          .map((m) => [m.name, m.lastName].filter(Boolean).join(" ") || "Mentör")
          .join(", ")
      : null;

  const completedProjects = projeler.map((p) => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    track: p.track,
    completedStepsCount: p.completedStepsCount,
    totalStepsCount: p.totalStepsCount,
    takimAdi: p.takimAdi,
  }));

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

