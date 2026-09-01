import "server-only";
import { prisma } from "@/lib/db";
import {
  ATAMA_SAHIPLIK_SELECT,
  erisebilirMi,
  mentoruMu,
  ogrencisiMi,
} from "@/features/teams/server/sahiplik";
import { logger } from "@/lib/logger";
import { isAssignedMentor } from "@/lib/auth/mentor-access";
import {
  baslatGitHubWorkspaceKurulumu,
  KurulumZatenSuruyorError,
} from "@/features/github/server/provisioning";

/**
 * Çalışma alanı talebi (#349).
 *
 * NEDEN VAR: Kurulumu tetikleyen uç ADMIN'e kapalı, ama öğrencinin ne zaman
 * hazır olduğunu bilen MENTÖR. Mentör bugüne kadar admin'e mesaj atıp
 * bekliyordu ve bu bekleyiş hiçbir yerde kayıtlı değildi.
 *
 * ⚠️ YETKİ MENTÖRE AÇILMIYOR. Mentör yalnızca TALEP eder; repoyu açan hâlâ
 * admin. `baslatGitHubWorkspaceKurulumu` kendi içinde `yoneticiOlduguDogrula()`
 * çağırıyor — bu modül o kapıyı atlamaz, onaylama yolu admin oturumundan geçer.
 */

export const TALEP_DURUMLARI = ["PENDING", "APPROVED", "REJECTED"] as const;
export type TalepDurumu = (typeof TALEP_DURUMLARI)[number];

/** Talep açılamama nedenleri — çağıran taraf HTTP durumunu buna göre seçer. */
export type TalepHatasi =
  | "atama-yok"
  | "yetki-yok"
  | "yol-haritasi-yok"
  | "zaten-kurulu"
  | "zaten-bekliyor";

export type TalepSonucu =
  | { ok: true; requestId: string }
  | { ok: false; neden: TalepHatasi };

/**
 * Kurulum GEREKMEYEN durumlar.
 *
 * `ERROR` bilerek DIŞARIDA: başarısız bir kurulumun yeniden talep edilebilmesi
 * gerekiyor, aksi halde bir kere patlayan atama kalıcı olarak kilitlenirdi.
 */
const KURULU_DURUMLAR = new Set(["PROVISIONED", "PROVISIONING"]);

/**
 * Mentörün talebini açar.
 *
 * Sıra kasıtlı: önce yetki (var olmayan/başkasının atamasının durumu bile
 * sızmasın), sonra ön koşullar, en sonda yazma.
 */
export async function talepOlustur(params: {
  assignedProjectId: string;
  mentorUserId: string;
  mentorNote?: string | null;
}): Promise<TalepSonucu> {
  const atama = await prisma.assignedProject.findUnique({
    where: { id: params.assignedProjectId },
    select: {
      id: true,
      githubStatus: true,
      roadmap: { select: { steps: { select: { id: true }, take: 1 } } },
      // #332: Sahiplik bireysel VEYA takım; tek tanımdan gelir.
      ...ATAMA_SAHIPLIK_SELECT,
    },
  });

  if (!atama) return { ok: false, neden: "atama-yok" };

  // #195: mentörler eşit yetkili, birincil mentör yok.
  if (!mentoruMu(atama, params.mentorUserId)) {
    return { ok: false, neden: "yetki-yok" };
  }

  if (KURULU_DURUMLAR.has(atama.githubStatus)) {
    return { ok: false, neden: "zaten-kurulu" };
  }

  // Kurulum yol haritası olmadan zaten başarısız olur; kuyruğa hiç düşmesin ve
  // mentör eksiği ŞİMDİ öğrensin, admin onayladıktan sonra değil.
  if (!atama.roadmap || atama.roadmap.steps.length === 0) {
    return { ok: false, neden: "yol-haritasi-yok" };
  }

  try {
    const talep = await prisma.workspaceRequest.create({
      data: {
        assignedProjectId: atama.id,
        requestedById: params.mentorUserId,
        // Bekleyen tekilliğini VERİTABANI uyguluyor (`pendingKey @unique`).
        // Yukarıda "bekleyen var mı" diye sorgulamıyoruz: iki eşzamanlı istek
        // arasında yarış penceresi bırakırdı.
        pendingKey: atama.id,
      },
      select: { id: true },
    });

    logger.info("Çalışma alanı talebi açıldı", {
      assignedProjectId: atama.id,
      requestId: talep.id,
    });
    return { ok: true, requestId: talep.id };
  } catch {
    // Tek beklenen ihlal `pendingKey`: bu atama için zaten bekleyen bir talep var.
    return { ok: false, neden: "zaten-bekliyor" };
  }
}

/** Admin kuyruğu. Bekleyenler en eskiden yeniye. */
export async function bekleyenTalepleriGetir() {
  return prisma.workspaceRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      mentorNote: true,
      createdAt: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      assignedProject: {
        select: {
          id: true,
          githubStatus: true,
          projectTemplate: { select: { title: true } },
          studentProfile: {
            select: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
}

/** Bu mentör bu atamayı görebilir mi? (#195 — mentörler eşit yetkili.) */
export async function atamayaErisebilirMi(
  assignedProjectId: string,
  mentorUserId: string,
): Promise<boolean> {
  const atama = await prisma.assignedProject.findUnique({
    where: { id: assignedProjectId },
    select: {
      // #332: Sahiplik bireysel VEYA takım.
      ...ATAMA_SAHIPLIK_SELECT,
    },
  });

  return Boolean(
    atama && mentoruMu(atama, mentorUserId),
  );
}

/** Bir atamanın mentöre gösterilecek talep durumu. */
export async function atamaninSonTalebi(assignedProjectId: string) {
  return prisma.workspaceRequest.findFirst({
    where: { assignedProjectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      adminNote: true,
      createdAt: true,
      decidedAt: true,
    },
  });
}

export type KararHatasi =
  | "talep-yok"
  | "zaten-karara-baglanmis"
  | "gerekce-gerekli"
  | "kurulum-suruyor";

export type KararSonucu =
  | { ok: true; durum: TalepDurumu; kurulumBaslatildi: boolean }
  | { ok: false; neden: KararHatasi; mesaj?: string };

/**
 * Admin talebi karara bağlar. Onayda kurulumu başlatır.
 *
 * ⚠️ KURULUM SONUCU BURADA TUTULMUYOR — bilinçli.
 * `baslatGitHubWorkspaceKurulumu` işi `after()` ile ARKA PLANDA yürütüyor ve
 * yalnızca "başlatıldı" bilgisini döndürüyor. Kurulumun gerçekte başarılı olup
 * olmadığının tek doğru kaynağı `AssignedProject.githubStatus`; onu talebe
 * kopyalasaydık iki kayıt kaçınılmaz olarak birbirinden ayrışırdı (arka plan
 * işi talebi tanımıyor, deploy sırasında yarıda kalabiliyor).
 *
 * Bunun yerine talep YALNIZCA İNSAN KARARINI kaydeder; kuyruk ve mentör ekranı
 * kurulumun akıbetini `githubStatus` üzerinden gösterir. `ERROR` durumundaki
 * bir atama yeniden talep edilebilir (bkz. `KURULU_DURUMLAR`), yani
 * "onaylandı ama ortada repo yok" hâli görünür kalır ve çıkışı vardır.
 */
export async function talebiKararaBagla(params: {
  requestId: string;
  adminUserId: string;
  onay: boolean;
  adminNote?: string | null;
}): Promise<KararSonucu> {
  const not = params.adminNote?.trim() || null;

  // Red gerekçesi zorunlu: mentör nedenini görmezse aynı talebi tekrar açar.
  if (!params.onay && !not) {
    return { ok: false, neden: "gerekce-gerekli" };
  }

  const yeniDurum: TalepDurumu = params.onay ? "APPROVED" : "REJECTED";

  // ATOMİK: yalnızca hâlâ PENDING olan talep karara bağlanabilir. Ayrı bir
  // okuma + yazma yapsaydık iki admin aynı talebi onaylayıp kurulumu iki kez
  // tetikleyebilirdi.
  const kilit = await prisma.workspaceRequest.updateMany({
    where: { id: params.requestId, status: "PENDING" },
    data: {
      status: yeniDurum,
      adminNote: not,
      decidedById: params.adminUserId,
      decidedAt: new Date(),
      // Bekleyen tekilliği serbest bırakılır: karara bağlanmış talepler
      // birikebilir, yeni bir talep açılabilir.
      pendingKey: null,
    },
  });

  if (kilit.count === 0) {
    // Talep ya yok ya da başkası önce karara bağladı. İkisini ayırmak için
    // tek bir okuma yeterli.
    const mevcut = await prisma.workspaceRequest.findUnique({
      where: { id: params.requestId },
      select: { id: true },
    });
    return {
      ok: false,
      neden: mevcut ? "zaten-karara-baglanmis" : "talep-yok",
    };
  }

  if (!params.onay) {
    logger.info("Çalışma alanı talebi reddedildi", { requestId: params.requestId });
    return { ok: true, durum: "REJECTED", kurulumBaslatildi: false };
  }

  const talep = await prisma.workspaceRequest.findUnique({
    where: { id: params.requestId },
    select: { assignedProjectId: true },
  });

  try {
    // `guncelleme: false` — talep akışı yalnızca İLK kurulum içindir. Kurulu bir
    // çalışma alanını yeniden üretmek (issue'ları tazelemek) admin panelindeki
    // ayrı bir işlem ve mentör talebine bağlanmadı.
    await baslatGitHubWorkspaceKurulumu(talep!.assignedProjectId, false);
  } catch (error) {
    // Kurulum başlatılamadı: kararı GERİ ALIYORUZ ki talep kuyrukta kalsın ve
    // admin tekrar deneyebilsin. Aksi halde talep "onaylandı" görünür, ortada
    // repo olmaz ve kimse fark etmez.
    await prisma.workspaceRequest.update({
      where: { id: params.requestId },
      data: {
        status: "PENDING",
        adminNote: null,
        decidedById: null,
        decidedAt: null,
        pendingKey: talep!.assignedProjectId,
      },
    });

    if (error instanceof KurulumZatenSuruyorError) {
      return { ok: false, neden: "kurulum-suruyor", mesaj: error.message };
    }

    logger.error("Onaylanan talebin kurulumu başlatılamadı", {
      requestId: params.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      neden: "kurulum-suruyor",
      mesaj: error instanceof Error ? error.message : "Kurulum başlatılamadı.",
    };
  }

  logger.info("Çalışma alanı talebi onaylandı, kurulum başlatıldı", {
    requestId: params.requestId,
  });
  return { ok: true, durum: "APPROVED", kurulumBaslatildi: true };
}
