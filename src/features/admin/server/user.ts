import { prisma } from "@/lib/db";
import { bildirimGonder } from "@/features/bildirim/server/bildirim";
import { BILDIRIM_TURLERI } from "@/features/bildirim/turler";
import { deleteStepFile } from "@/lib/storage/step-files";
import { ensureCertificateIssued } from "@/features/certificate/server/certificate";
import { logger } from "@/lib/logger";


// Type export
export type { KullaniciSayilari } from "@/features/admin/server/kullanici-okuma";
export * from "./kullanici-okuma";
export * from "./mentor-atama";
import { AssignmentValidationError } from "./mentor-atama";

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

