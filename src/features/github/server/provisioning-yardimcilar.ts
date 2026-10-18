import { prisma } from "@/lib/db";
import { repoAdiUret } from "./repo";

/**
 * GitHub kurulumunun saf ve veri okuyan yardımcıları (provisioning.ts'ten ayrıldı).
 * Kurulum akışı (ağ çağrıları, idempotens, kayıt) provisioning.ts'te kalır.
 */

export type Atama = NonNullable<Awaited<ReturnType<typeof atamayiYukle>>>;

export function atamayiYukle(assignmentId: string) {
  return prisma.assignedProject.findUnique({
    where: { id: assignmentId },
    include: {
      studentProfile: { include: { user: true } },
      // #332: Takım ataması — sahip öğrenci değil takım olabilir.
      team: {
        include: {
          members: {
            where: { leftAt: null },
            include: { studentProfile: { include: { user: true } } },
          },
        },
      },
      projectTemplate: true,
      roadmap: {
        include: {
          steps: { orderBy: { order: "asc" }, include: { issues: true } },
        },
      },
    },
  });
}

/**
 * #274: Repo adı ATAMAYA ÖZEL olmalı.
 *
 * Önceden yalnızca öğrenci adı + proje başlığından türetiliyordu. Adı aynı
 * olan iki öğrenci aynı projeye atandığında aynı adı üretiyorlardı; repo
 * işlemleri idempotent olduğu için ikinci öğrencinin issue'ları BİRİNCİNİN
 * reposuna açılırdı. Adı olmayanlar ("student" fallback'i) ise hepsi aynı
 * repoyu paylaşırdı.
 *
 * Sonek atama kimliğinden alınıyor: deterministik (aynı atama her zaman aynı
 * ada çözülür, idempotenslik korunur) ve atamalar arasında benzersiz.
 */
/** Repo açıklamasında görünen sahip: takım adı ya da stajyer adı (#332). */
export function sahipTanimi(atama: Atama): string {
  if (atama.team) {
    return `${atama.team.name} takımı (${atama.team.members.length} kişi)`;
  }
  return atama.studentProfile?.user.name ?? "stajyer";
}

/**
 * Takımın issue üretiminde kullanılacak deneyim seviyesi (#332).
 *
 * EN DÜŞÜK seviye seçiliyor: pano ortak ve en yeni üyenin de takip
 * edebilmesi gerekiyor. Ortalama almak, kimseye uymayan bir seviye üretirdi.
 */
export function takimSeviyesi(atama: Atama): string {
  if (!atama.team) return atama.studentProfile?.experienceLevel ?? "BEGINNER";

  const sira = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
  const seviyeler = atama.team.members.map((m) => m.studentProfile.experienceLevel);
  if (seviyeler.length === 0) return "BEGINNER";

  return seviyeler.reduce((enDusuk, s) =>
    sira.indexOf(s) < sira.indexOf(enDusuk) ? s : enDusuk,
  );
}

export function repoAdi(atama: Atama): string {
  const kisaKimlik = atama.id.slice(-8).toLowerCase();

  // #332: Takım atamasında repo TAKIM adından türetilir — üyelerden birinin
  // adını seçmek keyfi olurdu ve üye değiştiğinde repo adı anlamsızlaşırdı.
  const sahipAdi = atama.team
    ? atama.team.name
    : atama.studentProfile?.user.name || "student";

  return repoAdiUret(["aisigner", sahipAdi, atama.projectTemplate.title, kisaKimlik]);
}

/**
 * Kayıtlı milestone URL'inden numarayı çıkarır (#345).
 *
 * Numarayı saklamak için ayrı bir kolon eklemek yerine var olan URL'den
 * okuyoruz: kolon eklemek yıkıcı olmayan ama gereksiz bir migration olurdu ve
 * URL zaten numarayı içeriyor. Simülasyon modunda üretilen URL'ler de aynı
 * biçimde olduğu için ayrı bir dal gerekmiyor.
 *
 * Beklenmeyen bir biçimde `null` döner — o zaman milestone yeniden hazırlanır,
 * yani en kötü ihtimalle eski davranışa düşülür.
 */
export function milestoneNumarasiCikar(url: string | null): number | null {
  if (!url) return null;
  const eslesme = /\/milestone\/(\d+)(?:$|[/?#])/.exec(url);
  if (!eslesme) return null;
  const numara = Number(eslesme[1]);
  return Number.isSafeInteger(numara) && numara > 0 ? numara : null;
}

export function mesajUret(p: {
  createdMilestonesCount: number;
  createdIssuesCount: number;
  simulated: boolean;
  guncelleme: boolean;
}): string {
  if (p.simulated) {
    // #178-1: "oluşturuldu" değil "önizlendi" — GitHub'da fiziksel bir şey yok.
    return `Önizleme: ${p.createdMilestonesCount} faz ve ${p.createdIssuesCount} detaylı issue hazırlandı. (Not: Bu bir simülasyondur; GitHub'da gerçek repo/issue oluşturulmaz.)`;
  }

  if (p.guncelleme) {
    return p.createdMilestonesCount === 0 && p.createdIssuesCount === 0
      ? "Çalışma alanı zaten güncel — yeni faz veya issue eklenmedi."
      : `Çalışma alanı güncellendi: ${p.createdMilestonesCount} yeni faz, ${p.createdIssuesCount} yeni issue eklendi.`;
  }

  return `GitHub çalışma alanı oluşturuldu: ${p.createdMilestonesCount} faz ve ${p.createdIssuesCount} issue.`;
}
