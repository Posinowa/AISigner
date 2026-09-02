import "server-only";
import { Octokit } from "@octokit/rest";
import { logger } from "@/lib/logger";

/**
 * #255: Gerçek GitHub API istemcisi.
 *
 * Sözleşme: yapılandırma eksikse bu modül HATA FIRLATMAZ, `null` döner.
 * Çağıran taraf o zaman simülasyona düşebilir — token'ı olmayan bir geliştirme
 * ortamında uygulama çalışmayı sürdürmeli. (#241'deki `sendMail` yaklaşımı.)
 *
 * Token asla loglanmaz.
 */

export type GitHubConfig = {
  token: string;
  /** Repoların açılacağı hesap/organizasyon. */
  owner: string;
};

export const VARSAYILAN_ORG = "Posinowa";

/**
 * `.env`'den yapılandırmayı okur.
 *
 * Token yoksa `null` → gerçek API kullanılmaz. `GITHUB_ORG` tanımlı değilse
 * varsayılana düşer; bu bilinçli bir karar: arayüz zaten "Posinowa
 * organizasyonu" diyor. Yanlış hesapta repo açılmasın diye boş/whitespace
 * değer varsayılana DÜŞMEZ, geçersiz sayılır.
 */
export function readGitHubConfig(): GitHubConfig | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return null;

  const ham = process.env.GITHUB_ORG;
  // Tanımsız → varsayılan. Tanımlı ama boş → yapılandırma hatalı sayılır;
  // sessizce varsayılana düşmek yanlış hesapta repo açmaya yol açabilir.
  if (ham !== undefined && ham.trim() === "") {
    logger.error("GITHUB_ORG tanımlı ama boş — GitHub entegrasyonu devre dışı");
    return null;
  }

  return { token, owner: (ham ?? VARSAYILAN_ORG).trim() };
}

let onbellek: { token: string; octokit: Octokit } | null = null;

/** Aynı token için tek istemci; her çağrıda yeni bağlantı kurulmasın. */
export function getOctokit(config: GitHubConfig): Octokit {
  if (onbellek && onbellek.token === config.token) return onbellek.octokit;

  const octokit = new Octokit({ auth: config.token });
  onbellek = { token: config.token, octokit };
  return octokit;
}

export function resetGitHubClientForTests(): void {
  onbellek = null;
  sahipTuruOnbellegi.clear();
}

/**
 * Hedef hesabın türü (#346).
 *
 * `repos.createInOrg` YALNIZCA organizasyonlara açık; kişisel bir hesapta 404
 * döner. Kişisel hesap için `repos.createForAuthenticatedUser` gerekiyor.
 */
export type SahipTuru = "organizasyon" | "kendi-hesabim";

export type SahipTuruSonucu =
  | { ok: true; tur: SahipTuru }
  | { ok: false; neden: GitHubHataNedeni; aciklama?: string };

/** Hesap türü değişmez; token+owner başına bir kez sorulur. */
const sahipTuruOnbellegi = new Map<string, SahipTuru>();

/**
 * `owner` bir organizasyon mu, token sahibinin kendi hesabı mı?
 *
 * ⚠️ TAHMİN EDİLMEZ, SORULUR. "Önce createInOrg dene, 404 alırsan kişisel
 * hesaptır" yaklaşımı cazip ama yanlış: 404 silinmiş bir org, yanlış yazılmış
 * bir isim veya token'ın o org'u görememesi de olabilir. Sırayla deneyen bir
 * mantık bunların hepsini "kişisel hesap" sanıp DEPOYU BAŞKA YERE AÇARDI.
 *
 * ⚠️ KİŞİSEL HESAP YALNIZCA TOKEN SAHİBİNİNKİ OLABİLİR.
 * `createForAuthenticatedUser` depoyu her zaman TOKEN'IN sahibi altında açar —
 * `owner` alanı diye bir şey yok. `GITHUB_ORG` başka birinin kullanıcı adıysa
 * depo sessizce YANLIŞ HESAPTA açılır ve bu hiçbir yerde hata olarak
 * görünmez. Bu yüzden kimlik karşılaştırılıyor; tutmuyorsa açıkça reddediyoruz.
 */
export async function sahipTuruniCoz(config: GitHubConfig): Promise<SahipTuruSonucu> {
  const anahtar = `${config.token}:${config.owner}`;
  const onbellekli = sahipTuruOnbellegi.get(anahtar);
  if (onbellekli) return { ok: true, tur: onbellekli };

  const octokit = getOctokit(config);

  let tur: string;
  try {
    const hesap = await octokit.users.getByUsername({ username: config.owner });
    tur = hesap.data.type;
  } catch (error) {
    const neden = hataNedeni(error);
    logger.error("GitHub hesap türü çözülemedi", { owner: config.owner, neden });
    return { ok: false, neden };
  }

  if (tur === "Organization") {
    sahipTuruOnbellegi.set(anahtar, "organizasyon");
    return { ok: true, tur: "organizasyon" };
  }

  // Kişisel hesap: token'ın sahibi mi?
  let kendiKullaniciAdi: string;
  try {
    const ben = await octokit.users.getAuthenticated();
    kendiKullaniciAdi = ben.data.login;
  } catch (error) {
    return { ok: false, neden: hataNedeni(error) };
  }

  if (kendiKullaniciAdi.toLowerCase() !== config.owner.toLowerCase()) {
    logger.error("GITHUB_ORG başka bir kullanıcının hesabı", {
      owner: config.owner,
    });
    return {
      ok: false,
      neden: "yetki-yok",
      aciklama:
        `"${config.owner}" bir organizasyon değil ve token'ın sahibi de değil. ` +
        "Kişisel hesapta depo yalnızca token'ın kendi hesabında açılabilir.",
    };
  }

  sahipTuruOnbellegi.set(anahtar, "kendi-hesabim");
  return { ok: true, tur: "kendi-hesabim" };
}

export type GitHubHataNedeni =
  | "yetki-yok"
  | "bulunamadi"
  | "zaten-var"
  | "oran-siniri"
  | "bilinmeyen";

/**
 * Octokit hatasını ayırt edilebilir bir nedene çevirir.
 *
 * Ham hata yukarı sızmamalı: içinde istek başlıkları ve token izleri olabilir.
 */
export function hataNedeni(error: unknown): GitHubHataNedeni {
  const durum = (error as { status?: number })?.status;

  if (durum === 401 || durum === 403) {
    // 403 hem yetkisizlik hem oran sınırı olabilir; ayrımı başlık veriyor.
    const kalan = (error as { response?: { headers?: Record<string, string> } })
      ?.response?.headers?.["x-ratelimit-remaining"];
    if (kalan === "0") return "oran-siniri";
    return "yetki-yok";
  }

  if (durum === 404) return "bulunamadi";
  if (durum === 422) return "zaten-var";
  if (durum === 429) return "oran-siniri";

  return "bilinmeyen";
}

/** Kullanıcıya gösterilebilir açıklama. Token veya ham hata içermez. */
export function hataMesaji(neden: GitHubHataNedeni): string {
  switch (neden) {
    case "yetki-yok":
      return "GitHub yetkisi reddedildi. Token'ın ilgili hesapta repo açma izni olduğundan emin olun.";
    case "bulunamadi":
      return "GitHub üzerinde hedef bulunamadı. Hesap/organizasyon adını kontrol edin.";
    case "zaten-var":
      return "GitHub bu kaydın zaten var olduğunu bildirdi.";
    case "oran-siniri":
      return "GitHub oran sınırına takıldı. Bir süre sonra tekrar deneyin.";
    default:
      return "GitHub ile iletişimde beklenmeyen bir hata oluştu.";
  }
}
