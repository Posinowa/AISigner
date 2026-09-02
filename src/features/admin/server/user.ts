import { prisma } from "@/lib/db";
import { bildirimGonder, topluBildirimGonder } from "@/features/bildirim/server/bildirim";
import { BILDIRIM_TURLERI } from "@/features/bildirim/turler";
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
  // #259: Doğrulama tarihi (#247 ile doluyor). Dolu = doğrulanmış hesap.
  // Tarih hassas bilgi değil; admin zaten e-postayı görüyor.
  emailVerified: Date | null;
  // #265: Fotoğrafın depolama adı; arayüz yalnızca varlığına bakıyor.
  avatarFile: string | null;
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
      emailVerified: true,
      avatarFile: true,
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
  // #247 sözleşmesinin KAPISI: e-posta doğrulaması burada anlam kazanıyor.
  //
  // Doğrulama akışı vardı ama hiçbir yerde kapı değildi — `emailVerified` yalnız
  // bir rozet ve admin filtresiydi. Doğrulamayan kullanıcı her şeyi normal
  // kullanabiliyordu, yani özellik fiilen dekoratifti.
  //
  // Kapı neden BURASI: hesabı asıl aktifleştiren adım admin onayıdır. Girişi
  // engellemek yerine onayı engellemek üç şeyi birden koruyor:
  //   - PENDING kullanıcı profilini doldurmaya devam edebilir (#143 sözleşmesi),
  //   - SMTP sessizce çökerse (mail.ts bilerek hata fırlatmaz) kimse kilitli
  //     kalmaz — admin panelde "doğrulanmamış" görür ve durumu fark eder,
  //   - sahte/erişilemeyen adresle açılan hesap aktifleşemez.
  //
  // Yalnızca APPROVED kapılıdır: REJECTED ve PENDING'e dönüş her zaman serbest
  // (aksi halde admin hatalı bir onayı geri alamazdı). GRADUATED zaten önce
  // APPROVED olmayı gerektirir.
  if (accountStatus === "APPROVED") {
    const hedef = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });

    if (!hedef) {
      throw new AssignmentValidationError("Kullanıcı bulunamadı.");
    }

    if (!hedef.emailVerified) {
      throw new AssignmentValidationError(
        "Bu hesabın e-posta adresi henüz doğrulanmamış. Kullanıcı doğrulama " +
          "bağlantısına tıklamadan hesap onaylanamaz.",
      );
    }
  }

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

  /*
   * #380: Hesabın kaderini belirleyen olay — e-postaya da bağlı.
   *
   * REDDEDİLEN kullanıcı panele zaten giremez; e-posta olmasa sonucu HİÇ
   * öğrenemezdi. `bildirimGonder` fırlatmıyor: onay işlemi bildirim yüzünden
   * kırılmamalı.
   */
  const kararMetni: Record<string, { baslik: string; govde: string }> = {
    APPROVED: {
      baslik: "Hesabınız onaylandı",
      govde: "AISigner hesabınız onaylandı. Artık panelinize erişebilirsiniz.",
    },
    REJECTED: {
      baslik: "Hesap başvurunuz reddedildi",
      govde: "AISigner hesap başvurunuz onaylanmadı.",
    },
    GRADUATED: {
      baslik: "Tebrikler, mezun oldunuz",
      govde: "Stajınız tamamlandı ve sertifikanız hazır.",
    },
  };
  const karar = kararMetni[accountStatus];
  if (karar) {
    await bildirimGonder({
      userId: updated.id,
      tur: BILDIRIM_TURLERI.HESAP_KARARI,
      baslik: karar.baslik,
      govde: karar.govde,
      link: accountStatus === "REJECTED" ? "/account-status" : "/",
      eposta: updated.email,
    });
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

  // #380: Hangi bağların YENİ olduğunu bilmek için reconcile ÖNCESİ durum.
  const oncekiMentorIdler = new Set(
    (
      await prisma.mentorAssignment.findMany({
        where: { studentProfileId: profile.id },
        select: { mentorId: true },
      })
    ).map((m) => m.mentorId),
  );

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

  /*
   * #380: Mentör ataması — stajyerin süreci gerçekten burada başlıyor.
   *
   * KARŞILIKLI: mentör de yeni öğrencisini öğreniyor. Düşük sıklıkta, yüksek
   * değerli bir bildirim; e-postaya bağlı.
   *
   * ⚠️ Yalnız YENİ eklenen bağlar bildiriliyor. Reconcile her çağrıda tüm
   * listeyi yazıyor; hepsini bildirmek, listeden tek kişi çıkarıldığında
   * kalan herkese "yeni mentör atandı" göndermek olurdu.
   */
  const yeniMentorIdler = uniqueMentorIds.filter((id) => !oncekiMentorIdler.has(id));
  if (yeniMentorIdler.length > 0) {
    const [ogrenci, mentorlar] = await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: { email: true, name: true, lastName: true },
      }),
      prisma.user.findMany({
        where: { id: { in: yeniMentorIdler } },
        select: { id: true, email: true, name: true, lastName: true },
      }),
    ]);

    const ad = (u: { name: string | null; lastName: string | null } | null) =>
      [u?.name, u?.lastName].filter(Boolean).join(" ") || "Kullanıcı";

    await topluBildirimGonder([
      {
        userId: studentId,
        tur: BILDIRIM_TURLERI.MENTOR_ATANDI,
        baslik: "Mentörünüz atandı",
        govde: `Size ${mentorlar.map(ad).join(", ")} mentör olarak atandı.`,
        link: "/student-dashboard",
        eposta: ogrenci?.email ?? null,
      },
      ...mentorlar.map((m) => ({
        userId: m.id,
        tur: BILDIRIM_TURLERI.MENTOR_ATANDI,
        baslik: "Yeni öğrenciniz var",
        govde: `${ad(ogrenci)} size stajyer olarak atandı.`,
        link: `/mentor-dashboard/${studentId}`,
        eposta: m.email,
      })),
    ]);
  }

  return { studentProfileId: profile.id, mentorIds: uniqueMentorIds };
}
