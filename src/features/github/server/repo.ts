import "server-only";
import { getOctokit, hataNedeni, type GitHubConfig } from "./client";
import { yenidenDene } from "./retry";
import { logger } from "@/lib/logger";

/**
 * #255: Repo / milestone / issue işlemleri.
 *
 * Hepsi İDEMPOTENT: aynı çağrı ikinci kez yapıldığında kopya oluşturmaz,
 * mevcut kaydı döndürür. "Çalışma alanını güncelle" akışı buna dayanacak —
 * güncelleme, var olanları atlayıp eksikleri tamamlamak demek.
 *
 * Hiçbiri ham Octokit hatası fırlatmaz; yapılandırılmış sonuç döner.
 */

export type IslemSonucu<T> =
  | { ok: true; veri: T; olusturuldu: boolean }
  | { ok: false; neden: ReturnType<typeof hataNedeni> };

export type RepoBilgisi = { name: string; htmlUrl: string };
export type MilestoneBilgisi = { number: number; title: string };
export type IssueBilgisi = { number: number; htmlUrl: string; title: string };

/** GitHub repo adı olarak güvenli hale getirir. */
export function repoAdiUret(parcalar: string[]): string {
  const gövde = parcalar
    .join("-")
    .toLowerCase()
    // Türkçe karakterler GitHub repo adında geçmez; karşılıklarına çevir.
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return gövde || "aisigner-proje";
}

/**
 * Repo yoksa oluşturur, varsa mevcut olanı döndürür.
 *
 * Önce okuma denenir: "önce oluştur, 422 alırsan var say" yaklaşımı yarış
 * durumunda yanlış repoyu sahiplenebilirdi.
 */
export async function repoyuHazirla(
  config: GitHubConfig,
  params: { repoName: string; description: string; private?: boolean },
): Promise<IslemSonucu<RepoBilgisi>> {
  const octokit = getOctokit(config);
  const { repoName } = params;

  try {
    const mevcut = await yenidenDene(
      () => octokit.repos.get({ owner: config.owner, repo: repoName }),
      { ad: "repos.get" },
    );
    return {
      ok: true,
      olusturuldu: false,
      veri: { name: mevcut.data.name, htmlUrl: mevcut.data.html_url },
    };
  } catch (error) {
    if (hataNedeni(error) !== "bulunamadi") {
      const neden = hataNedeni(error);
      logger.error("GitHub repo okunamadı", { repoName, neden });
      return { ok: false, neden };
    }
    // 404 → henüz yok, oluşturmaya devam.
  }

  try {
    // Organizasyon altında açmak ayrı bir uç; kişisel hesapta bu 404 verir.
    const yeni = await yenidenDene(
      () =>
        octokit.repos.createInOrg({
          org: config.owner,
          name: repoName,
          description: params.description,
          private: params.private ?? true,
          auto_init: true,
        }),
      { ad: "repos.createInOrg" },
    );
    return {
      ok: true,
      olusturuldu: true,
      veri: { name: yeni.data.name, htmlUrl: yeni.data.html_url },
    };
  } catch (error) {
    const neden = hataNedeni(error);
    logger.error("GitHub repo oluşturulamadı", { repoName, neden });
    return { ok: false, neden };
  }
}

/** Aynı başlıklı milestone varsa onu döndürür, yoksa oluşturur. */
export async function milestoneHazirla(
  config: GitHubConfig,
  params: { repoName: string; title: string; description?: string },
): Promise<IslemSonucu<MilestoneBilgisi>> {
  const octokit = getOctokit(config);

  try {
    // Kapalı olanlar da taranır: kapanmış bir fazın kopyası açılmasın.
    const mevcutlar = await yenidenDene(
      () =>
        octokit.issues.listMilestones({
          owner: config.owner,
          repo: params.repoName,
          state: "all",
          per_page: 100,
        }),
      { ad: "issues.listMilestones" },
    );

    const eslesen = mevcutlar.data.find((m) => m.title === params.title);
    if (eslesen) {
      return {
        ok: true,
        olusturuldu: false,
        veri: { number: eslesen.number, title: eslesen.title },
      };
    }
  } catch (error) {
    const neden = hataNedeni(error);
    logger.error("GitHub milestone listelenemedi", { neden });
    return { ok: false, neden };
  }

  try {
    const yeni = await yenidenDene(
      () =>
        octokit.issues.createMilestone({
          owner: config.owner,
          repo: params.repoName,
          title: params.title,
          description: params.description,
        }),
      { ad: "issues.createMilestone" },
    );
    return {
      ok: true,
      olusturuldu: true,
      veri: { number: yeni.data.number, title: yeni.data.title },
    };
  } catch (error) {
    const neden = hataNedeni(error);
    logger.error("GitHub milestone oluşturulamadı", { neden });
    return { ok: false, neden };
  }
}

/**
 * Aynı başlıklı issue varsa onu döndürür, yoksa oluşturur.
 *
 * ⚠️ BAŞLIK TARAMASI BİR GARANTİ DEĞİL, YEDEKTİR (#345).
 *
 * Kopya kontrolü `issues.listForRepo` sonucunda başlık eşleştirmeye dayanıyor.
 * GitHub'ın liste uçları ANINDA TUTARLI DEĞİL: yeni açılmış bir issue listede
 * gecikmeli görünüyor. Canlı testte art arda iki çağrı KOPYA issue açtı —
 * üçüncü çağrıda (liste yetiştiğinde) doğru davrandı.
 *
 * Bu yüzden idempotensin OTORİTER kaynağı burası değil, veritabanıdır:
 * `provisioning.ts` `StepIssue.githubIssueUrl` dolu olan kaydı GitHub'a hiç
 * göndermiyor. Buradaki tarama yalnızca "issue açıldı ama URL kaydedilemeden
 * süreç öldü" gibi dar bir boşluğu kapatan yedek katmandır.
 *
 * Aynı uyarı `milestoneHazirla` için de geçerli.
 */
export async function issueHazirla(
  config: GitHubConfig,
  params: {
    repoName: string;
    title: string;
    body: string;
    milestoneNumber?: number;
  },
): Promise<IslemSonucu<IssueBilgisi>> {
  const octokit = getOctokit(config);

  try {
    const mevcutlar = await yenidenDene(
      () =>
        octokit.issues.listForRepo({
          owner: config.owner,
          repo: params.repoName,
          state: "all",
          per_page: 100,
        }),
      { ad: "issues.listForRepo" },
    );

    const eslesen = mevcutlar.data.find((i) => i.title === params.title);
    if (eslesen) {
      return {
        ok: true,
        olusturuldu: false,
        veri: {
          number: eslesen.number,
          htmlUrl: eslesen.html_url,
          title: eslesen.title,
        },
      };
    }
  } catch (error) {
    const neden = hataNedeni(error);
    logger.error("GitHub issue listelenemedi", { neden });
    return { ok: false, neden };
  }

  try {
    const yeni = await yenidenDene(
      () =>
        octokit.issues.create({
          owner: config.owner,
          repo: params.repoName,
          title: params.title,
          body: params.body,
          milestone: params.milestoneNumber,
        }),
      { ad: "issues.create" },
    );
    return {
      ok: true,
      olusturuldu: true,
      veri: {
        number: yeni.data.number,
        htmlUrl: yeni.data.html_url,
        title: yeni.data.title,
      },
    };
  } catch (error) {
    const neden = hataNedeni(error);
    logger.error("GitHub issue oluşturulamadı", { neden });
    return { ok: false, neden };
  }
}
