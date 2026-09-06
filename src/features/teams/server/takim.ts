import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { atamaTekilKey } from "@/features/projects/tekil-anahtar";

/**
 * Takım yönetimi (#332 Faz 2).
 *
 * Faz 1 şemayı ve sahiplik katmanını kurdu ama takım OLUŞTURULAMIYORDU.
 * Bu modül takımın yaşam döngüsünü yönetiyor: kurulum, üyelik, mentör, proje.
 *
 * ⚠️ ÜYELİK SATIRI SİLİNMEZ, `leftAt` ile işaretlenir. Ayrılan üyenin panodaki
 * katkısı (üstlendiği adımlar, tamamladığı işler) bireysel sertifikasının
 * dayanağı; satırı silmek o geçmişi sahipsiz bırakırdı. Sahiplik sorguları
 * zaten `leftAt: null` ile daraltıyor (bkz. `sahiplik.ts`).
 */

/** Takımdaki roller. Serbest metin DEĞİL: eşleştirme ve arayüz tek sözlükten okur. */
export const TAKIM_ROLLERI = ["frontend", "backend", "fullstack", "qa", "design"] as const;
export type TakimRolu = (typeof TAKIM_ROLLERI)[number];

export const ROL_ETIKETLERI: Record<TakimRolu, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full-stack",
  qa: "QA / Test",
  design: "Tasarım",
};

/**
 * Takım büyüklüğü sınırı.
 *
 * #332'nin fikri "2-4 kişilik takımlar". Üst sınır teknik değil PEDAGOJİK:
 * kalabalık takımda tek panoda iş bölümü dağılır ve bireysel katkı ölçülemez
 * hale gelir — sertifika bireysel olduğu için bu doğrudan sorun.
 */
export const ASGARI_UYE = 2;
export const AZAMI_UYE = 4;

export type TakimHatasi =
  | "takim-yok"
  | "ogrenci-yok"
  | "ogrenci-degil"
  | "zaten-uye"
  | "uye-degil"
  | "takim-dolu"
  | "mentor-degil"
  | "sablon-yok"
  | "zaten-atanmis"
  | "yetersiz-uye"
  | "aktif-atama-var";

export type Sonuc<T = void> = { ok: true; veri: T } | { ok: false; neden: TakimHatasi };

/** Takım listesi — admin paneli için. */
export async function takimlariGetir() {
  return prisma.team.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      members: {
        // Ayrılmışlar da dönüyor: admin geçmişi görebilmeli. Arayüz ayırıyor.
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          role: true,
          leftAt: true,
          studentProfile: {
            select: {
              id: true,
              user: { select: { id: true, name: true, lastName: true, email: true } },
            },
          },
        },
      },
      mentors: {
        select: {
          mentor: { select: { id: true, name: true, lastName: true, email: true } },
        },
      },
      assignedProjects: {
        select: {
          id: true,
          githubStatus: true,
          githubRepoUrl: true,
          projectTemplate: { select: { id: true, title: true } },
        },
      },
    },
  });
}

export async function takimOlustur(ad: string): Promise<Sonuc<{ id: string }>> {
  const takim = await prisma.team.create({
    data: { name: ad.trim() },
    select: { id: true },
  });
  logger.info("Takım oluşturuldu", { teamId: takim.id });
  return { ok: true, veri: takim };
}

/**
 * Üye ekler.
 *
 * AYRILMIŞ ÜYE GERİ ALINABİLİR: `leftAt` temizlenir, satır yeniden kullanılır.
 * Yeni satır açmak, aynı kişinin takımda iki üyelik kaydı olması demekti ve
 * `@@unique([teamId, studentProfileId])` zaten buna izin vermiyor.
 */
export async function uyeEkle(params: {
  teamId: string;
  studentUserId: string;
  role: TakimRolu;
}): Promise<Sonuc> {
  const takim = await prisma.team.findUnique({
    where: { id: params.teamId },
    select: { id: true, members: { where: { leftAt: null }, select: { id: true } } },
  });
  if (!takim) return { ok: false, neden: "takim-yok" };
  if (takim.members.length >= AZAMI_UYE) return { ok: false, neden: "takim-dolu" };

  const kullanici = await prisma.user.findUnique({
    where: { id: params.studentUserId },
    select: { role: true, studentProfile: { select: { id: true } } },
  });
  if (!kullanici) return { ok: false, neden: "ogrenci-yok" };
  // Mentör/admin takıma üye olamaz; takım stajyer takımı.
  if (kullanici.role !== "STUDENT" || !kullanici.studentProfile) {
    return { ok: false, neden: "ogrenci-degil" };
  }

  const mevcut = await prisma.teamMember.findUnique({
    where: {
      teamId_studentProfileId: {
        teamId: params.teamId,
        studentProfileId: kullanici.studentProfile.id,
      },
    },
    select: { id: true, leftAt: true },
  });

  if (mevcut && mevcut.leftAt === null) return { ok: false, neden: "zaten-uye" };

  if (mevcut) {
    // Geri alma: aynı satır yeniden aktifleşiyor, katkı geçmişi korunuyor.
    await prisma.teamMember.update({
      where: { id: mevcut.id },
      data: { leftAt: null, role: params.role, joinedAt: new Date() },
    });
  } else {
    await prisma.teamMember.create({
      data: {
        teamId: params.teamId,
        studentProfileId: kullanici.studentProfile.id,
        role: params.role,
      },
    });
  }

  logger.info("Takıma üye eklendi", { teamId: params.teamId });
  return { ok: true, veri: undefined };
}

/** Üyeyi ayırır — satır SİLİNMEZ, `leftAt` işaretlenir. */
export async function uyeAyir(params: { teamId: string; memberId: string }): Promise<Sonuc> {
  const kilit = await prisma.teamMember.updateMany({
    where: { id: params.memberId, teamId: params.teamId, leftAt: null },
    data: { leftAt: new Date() },
  });

  if (kilit.count === 0) return { ok: false, neden: "uye-degil" };

  // #332: Ayrılan üyenin ÜSTLENDİĞİ adımlar sahipsiz kalmasın — panoya geri
  // düşsün. Tamamladığı işler `StepStatusHistory`'de kalır, oraya dokunmuyoruz.
  const uye = await prisma.teamMember.findUnique({
    where: { id: params.memberId },
    select: { studentProfile: { select: { userId: true } } },
  });

  if (uye) {
    await prisma.roadmapStep.updateMany({
      where: {
        assigneeId: uye.studentProfile.userId,
        roadmap: { assignedProject: { teamId: params.teamId } },
      },
      data: { assigneeId: null },
    });
  }

  logger.info("Takımdan üye ayrıldı", { teamId: params.teamId, memberId: params.memberId });
  return { ok: true, veri: undefined };
}

/** Takımın mentörlerini ayarlar (tam küme). */
export async function mentorleriAyarla(params: {
  teamId: string;
  mentorIds: string[];
}): Promise<Sonuc> {
  const takim = await prisma.team.findUnique({ where: { id: params.teamId }, select: { id: true } });
  if (!takim) return { ok: false, neden: "takim-yok" };

  const benzersiz = [...new Set(params.mentorIds)];
  if (benzersiz.length > 0) {
    const mentorlar = await prisma.user.findMany({
      where: { id: { in: benzersiz }, role: "MENTOR" },
      select: { id: true },
    });
    // Rolü MENTOR olmayan biri takım mentörü yapılamaz.
    if (mentorlar.length !== benzersiz.length) return { ok: false, neden: "mentor-degil" };
  }

  await prisma.$transaction([
    prisma.teamMentor.deleteMany({ where: { teamId: params.teamId } }),
    prisma.teamMentor.createMany({
      data: benzersiz.map((mentorId) => ({ teamId: params.teamId, mentorId })),
    }),
  ]);

  return { ok: true, veri: undefined };
}

/**
 * Takıma proje atar.
 *
 * ⚠️ ASGARİ ÜYE ŞARTI: takım projesi en az iki kişiyle anlamlı. Tek kişilik
 * "takım" bireysel atamanın karmaşık bir kopyası olurdu; o kişi zaten normal
 * atama alabilir.
 */
export async function takimaProjeAta(params: {
  teamId: string;
  projectTemplateId: string;
}): Promise<Sonuc<{ assignedProjectId: string }>> {
  const takim = await prisma.team.findUnique({
    where: { id: params.teamId },
    select: {
      id: true,
      members: { where: { leftAt: null }, select: { id: true } },
    },
  });
  if (!takim) return { ok: false, neden: "takim-yok" };
  if (takim.members.length < ASGARI_UYE) return { ok: false, neden: "yetersiz-uye" };

  const sablon = await prisma.projectTemplate.findUnique({
    where: { id: params.projectTemplateId },
    select: { id: true, tekrarlanabilir: true },
  });
  if (!sablon) return { ok: false, neden: "sablon-yok" };

  try {
    const atama = await prisma.assignedProject.create({
      // studentProfileId BİLEREK verilmiyor: CHECK kısıtı sahibin tam biri
      // olmasını şart koşuyor (#332 Faz 1).
      data: {
        teamId: params.teamId,
        projectTemplateId: params.projectTemplateId,
        // #503: Koşullu tekillik. Tekrarlanamaz şablonda anahtar dolu →
        // "aynı proje aynı takıma iki kez" koruması sürer (#332);
        // tekrarlanabilirde NULL.
        tekilKey: atamaTekilKey({
          projectTemplateId: params.projectTemplateId,
          tekrarlanabilir: sablon.tekrarlanabilir,
          teamId: params.teamId,
        }),
      },
      select: { id: true },
    });
    logger.info("Takıma proje atandı", { teamId: params.teamId, assignedProjectId: atama.id });
    return { ok: true, veri: { assignedProjectId: atama.id } };
  } catch {
    // #503: Tek beklenen ihlal artık `tekilKey` benzersizliği (eski
    // @@unique([teamId, projectTemplateId]) onun yerine geçti).
    return { ok: false, neden: "zaten-atanmis" };
  }
}

/**
 * Bir adımı üstlenir ya da bırakır (#332).
 *
 * Adım TAKIMIN; bu yalnızca "kim çekti" bilgisi. Sprint panosunda iş havuzda
 * durur, biri üzerine alır — bu yüzden BAŞKASININ üstlendiği adım da
 * devralınabiliyor (kilitlemek pull modelini bozar). Kimin tamamladığı ayrıca
 * `StepStatusHistory.changedById`'de tutuluyor (#324).
 */
export async function adimiUstlen(params: {
  stepId: string;
  userId: string | null;
}): Promise<Sonuc> {
  const guncellenen = await prisma.roadmapStep.updateMany({
    where: { id: params.stepId },
    data: { assigneeId: params.userId },
  });
  if (guncellenen.count === 0) return { ok: false, neden: "takim-yok" };
  return { ok: true, veri: undefined };
}
