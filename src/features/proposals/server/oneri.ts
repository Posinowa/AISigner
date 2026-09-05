import "server-only";
import { bildirimGonder } from "@/features/bildirim/server/bildirim";
import { BILDIRIM_TURLERI } from "@/features/bildirim/turler";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { readGitHubConfig, getOctokit } from "@/features/github/server/client";
import { bireyselTekilKey } from "@/features/projects/tekil-anahtar";

/**
 * Stajyerin kendi proje önerisi (#366).
 *
 * Üç GitHub kaynağı TEK akışta: öneri → onay → kaynak seçimi.
 *
 * ⚠️ KAYNAK KARARI ADMİN'İN. Stajyer yalnızca TERCİHİNİ belirtir; hem depo
 * bağlama hem devretme organizasyonu ilgilendirdiği için nihai kararı admin
 * verir (`kararKaynak`).
 */

export const KAYNAKLAR = ["BIZIM", "BAGLA", "DEVRET"] as const;
export type Kaynak = (typeof KAYNAKLAR)[number];

export const KAYNAK_ETIKETLERI: Record<Kaynak, string> = {
  BIZIM: "Repoyu biz açalım",
  BAGLA: "Var olan depomu bağlayın",
  DEVRET: "Depomu organizasyona devredeceğim",
};

/**
 * Dış depo durumu (#366).
 *
 * `githubStatus` alanına yeni bir değer: repo VAR ama BİZ KURMADIK. Provisioning
 * bu atamalara dokunmamalı — aksi halde stajyerin deposunun üstüne milestone ve
 * issue açardı.
 */
export const DIS_DEPO_DURUMU = "LINKED";

export type OneriHatasi =
  | "profil-yok"
  | "zaten-bekliyor"
  | "oneri-yok"
  | "zaten-karara-baglanmis"
  | "gerekce-gerekli"
  | "repo-gerekli"
  | "repo-bulunamadi"
  | "devir-tamamlanmamis"
  | "baslik-cakismasi";

export type Sonuc<T = void> = { ok: true; veri: T } | { ok: false; neden: OneriHatasi };

/** GitHub URL'inden `sahip/depo` çıkarır. */
export function repoAyristir(url: string): { owner: string; repo: string } | null {
  const m = /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(
    url.trim(),
  );
  return m ? { owner: m[1], repo: m[2] } : null;
}

export async function oneriOlustur(params: {
  studentUserId: string;
  title: string;
  description: string;
  goals: string;
  technologies: string[];
  kaynak: Kaynak;
  repoUrl?: string | null;
}): Promise<Sonuc<{ id: string }>> {
  const profil = await prisma.studentProfile.findUnique({
    where: { userId: params.studentUserId },
    select: { id: true },
  });
  if (!profil) return { ok: false, neden: "profil-yok" };

  // BAGLA ve DEVRET bir depo olmadan anlamsız; BIZIM'de depo beklenmiyor.
  if (params.kaynak !== "BIZIM" && !repoAyristir(params.repoUrl ?? "")) {
    return { ok: false, neden: "repo-gerekli" };
  }

  try {
    const oneri = await prisma.projectProposal.create({
      data: {
        studentProfileId: profil.id,
        title: params.title,
        description: params.description,
        goals: params.goals,
        technologies: params.technologies,
        kaynak: params.kaynak,
        repoUrl: params.kaynak === "BIZIM" ? null : (params.repoUrl ?? null),
        // Bekleyen tekilliği VERİTABANINDA (#345/#349 dersi).
        pendingKey: profil.id,
      },
      select: { id: true },
    });
    logger.info("Proje önerisi oluşturuldu", { proposalId: oneri.id });
    return { ok: true, veri: oneri };
  } catch {
    return { ok: false, neden: "zaten-bekliyor" };
  }
}

/** Stajyerin kendi önerileri (en yeniden eskiye). */
export async function ogrencininOnerileri(studentUserId: string) {
  return prisma.projectProposal.findMany({
    where: { studentProfile: { userId: studentUserId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      goals: true,
      technologies: true,
      kaynak: true,
      kararKaynak: true,
      repoUrl: true,
      status: true,
      adminNote: true,
      createdAt: true,
      decidedAt: true,
      assignedProjectId: true,
    },
  });
}

/** Admin kuyruğu. */
export async function bekleyenOneriler() {
  return prisma.projectProposal.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      goals: true,
      technologies: true,
      kaynak: true,
      repoUrl: true,
      createdAt: true,
      studentProfile: {
        select: {
          experienceLevel: true,
          user: { select: { id: true, name: true, lastName: true, email: true } },
        },
      },
    },
  });
}

/**
 * Devir gerçekleşti mi?
 *
 * ⚠️ Transferi BİZ BAŞLATAMAYIZ (GitHub'ın ucu yalnız depo sahibine açık).
 * Yapabildiğimiz, deponun artık ORGANİZASYON altında görünüp görünmediğine
 * bakmak. Depo adı transferde değişmez, o yüzden aynı adla org altında arıyoruz.
 */
export async function devirTamamlandiMi(repoUrl: string): Promise<{ tamam: boolean; yeniUrl?: string }> {
  const config = readGitHubConfig();
  const ayrik = repoAyristir(repoUrl);
  if (!config || !ayrik) return { tamam: false };

  try {
    const r = await getOctokit(config).repos.get({ owner: config.owner, repo: ayrik.repo });
    return { tamam: true, yeniUrl: r.data.html_url };
  } catch {
    // 404 = henüz devredilmemiş. Diğer hatalar da "henüz değil" sayılıyor:
    // yanlışlıkla "devredildi" demek, kurulmamış bir depoyu bağlamak olurdu.
    return { tamam: false };
  }
}

/**
 * Öneriden şablon üretir.
 *
 * `ProjectTemplate.title` @unique (#112): iki stajyer aynı başlığı önerirse
 * çakışır. Kısıtı kaldırmak yerine (seed idempotensi ona dayanıyor) başlığa
 * kısa bir ek koyuyoruz.
 */
async function sablonUret(params: {
  title: string;
  description: string;
  technologies: string[];
  createdById: string;
}): Promise<{ id: string } | null> {
  for (const ek of ["", ` (${Date.now().toString(36).slice(-4)})`]) {
    try {
      return await prisma.projectTemplate.create({
        data: {
          title: params.title + ek,
          description: params.description,
          track: params.technologies.slice(0, 10),
          difficulty: "MEDIUM",
          createdById: params.createdById,
          // Ortak havuza girmesin.
          fromProposal: true,
        },
        select: { id: true },
      });
    } catch {
      // Başlık çakıştı; sonraki denemede ek ile tekrar.
    }
  }
  return null;
}

export type KararSonucu =
  | { ok: true; assignedProjectId: string; kaynak: Kaynak }
  | { ok: false; neden: OneriHatasi; mesaj?: string };

/**
 * Öneriyi karara bağlar.
 *
 * Onayda atama OLUŞTURULUR ve `kararKaynak`'a göre GitHub tarafı ayarlanır:
 *   BIZIM  → `githubStatus` NOT_PROVISIONED; kurulum ayrı bir adım (#349)
 *   BAGLA  → `githubRepoUrl` doldurulur, `githubStatus` LINKED (provisioning
 *            bu atamaya DOKUNMAZ; stajyerin deposuna issue açmak olurdu)
 *   DEVRET → devir TAMAMLANMIŞ olmalı; org altındaki URL bağlanır
 */
export async function oneriyiKararaBagla(params: {
  proposalId: string;
  adminUserId: string;
  onay: boolean;
  adminNote?: string | null;
  kaynak?: Kaynak;
}): Promise<KararSonucu> {
  const not = params.adminNote?.trim() || null;

  // Red gerekçesi zorunlu: stajyer nedenini görmezse aynı öneriyi tekrar açar.
  if (!params.onay && !not) return { ok: false, neden: "gerekce-gerekli" };

  const oneri = await prisma.projectProposal.findUnique({
    where: { id: params.proposalId },
    select: {
      id: true,
      status: true,
      title: true,
      description: true,
      technologies: true,
      kaynak: true,
      repoUrl: true,
      // #380: Bildirim e-postası için.
      studentProfile: { select: { id: true, userId: true, user: { select: { email: true } } } },
    },
  });
  if (!oneri) return { ok: false, neden: "oneri-yok" };
  if (oneri.status !== "PENDING") return { ok: false, neden: "zaten-karara-baglanmis" };

  // --- RED
  if (!params.onay) {
    const kilit = await prisma.projectProposal.updateMany({
      where: { id: params.proposalId, status: "PENDING" },
      data: {
        status: "REJECTED",
        adminNote: not,
        decidedById: params.adminUserId,
        decidedAt: new Date(),
        pendingKey: null,
      },
    });
    if (kilit.count === 0) return { ok: false, neden: "zaten-karara-baglanmis" };

    // #380: Stajyer günlerce bekliyor olabilir; sonucu öğrenmek için panele
    // girmesi gerekiyordu. Red gerekçesi ZATEN zorunlu — bildirimde de o var.
    await bildirimGonder({
      userId: oneri.studentProfile.userId,
      tur: BILDIRIM_TURLERI.ONERI_KARARI,
      baslik: "Proje öneriniz reddedildi",
      govde: not ?? "",
      link: "/student-dashboard",
      eposta: oneri.studentProfile.user?.email ?? null,
    });

    return { ok: true, assignedProjectId: "", kaynak: "BIZIM" };
  }

  // --- ONAY
  const kaynak = (params.kaynak ?? oneri.kaynak) as Kaynak;

  let repoUrl: string | null = null;

  if (kaynak === "BAGLA") {
    if (!oneri.repoUrl || !repoAyristir(oneri.repoUrl)) {
      return { ok: false, neden: "repo-gerekli" };
    }
    repoUrl = oneri.repoUrl;
  }

  if (kaynak === "DEVRET") {
    if (!oneri.repoUrl) return { ok: false, neden: "repo-gerekli" };
    // ⚠️ Devri BİZ yapmıyoruz; yalnızca gerçekleşip gerçekleşmediğine bakıyoruz.
    const devir = await devirTamamlandiMi(oneri.repoUrl);
    if (!devir.tamam) return { ok: false, neden: "devir-tamamlanmamis" };
    repoUrl = devir.yeniUrl ?? null;
  }

  const sablon = await sablonUret({
    title: oneri.title,
    description: oneri.description,
    technologies: oneri.technologies,
    createdById: oneri.studentProfile.userId,
  });
  if (!sablon) return { ok: false, neden: "baslik-cakismasi" };

  const atama = await prisma.assignedProject.create({
    data: {
      studentProfileId: oneri.studentProfile.id,
      projectTemplateId: sablon.id,
      githubRepoUrl: repoUrl,
      // LINKED/devredilmiş depoya provisioning DOKUNMAMALI.
      githubStatus: repoUrl ? DIS_DEPO_DURUMU : "NOT_PROVISIONED",
      // #503: Öneriden türeyen şablon `fromProposal: true` ve tek stajyere
      // özel (#366) — tekrarlanabilir DEĞİL, yani anahtar her zaman dolu.
      tekilKey: bireyselTekilKey(oneri.studentProfile.id, sablon.id),
    },
    select: { id: true },
  });

  const kilit = await prisma.projectProposal.updateMany({
    where: { id: params.proposalId, status: "PENDING" },
    data: {
      status: "APPROVED",
      adminNote: not,
      kararKaynak: kaynak,
      decidedById: params.adminUserId,
      decidedAt: new Date(),
      assignedProjectId: atama.id,
      pendingKey: null,
    },
  });

  if (kilit.count === 0) {
    // Başkası araya girdi: oluşturduğumuz atamayı geri al, yetim kalmasın.
    await prisma.assignedProject.delete({ where: { id: atama.id } }).catch(() => {});
    return { ok: false, neden: "zaten-karara-baglanmis" };
  }

  await bildirimGonder({
    userId: oneri.studentProfile.userId,
    tur: BILDIRIM_TURLERI.ONERI_KARARI,
    baslik: "Proje öneriniz onaylandı",
    govde: "Öneriniz kabul edildi ve size proje olarak atandı.",
    link: "/student-dashboard",
    eposta: oneri.studentProfile.user?.email ?? null,
  });

  logger.info("Proje önerisi onaylandı", { proposalId: oneri.id, kaynak });
  return { ok: true, assignedProjectId: atama.id, kaynak };
}
