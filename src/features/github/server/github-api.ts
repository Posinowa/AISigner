import { logger } from "@/lib/logger";

const GITHUB_API_BASE = "https://api.github.com";

// #179 review: Rate-limit / geçici hatalar için ÜST SINIRLI retry.
// Sınırsız retry provisioning'i süresiz bloke edebilir.
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;
/** #218 review: Tek bir GitHub isteğinin üst süre sınırı. */
const REQUEST_TIMEOUT_MS = 15000;

export function isGitHubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

function getHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN tanımlı değil");
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AISigner-App",
    "Content-Type": "application/json",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 429, 5xx ve 403-rate-limit geçici kabul edilir.
 *
 * #218 review [P2]: GitHub **secondary rate limit**'te primary kota çoğu zaman
 * TÜKENMEZ (`x-ratelimit-remaining > 0`). Sinyal `Retry-After` başlığı ve/veya
 * gövdedeki "secondary rate limit" ifadesidir. Yalnız `remaining === "0"`e bakmak
 * toplu issue açışındaki gerçek 403'leri tek denemede düşürüyordu.
 */
async function isRetryable(res: Response): Promise<boolean> {
  if (res.status === 429) return true;
  if (res.status >= 500) return true;

  if (res.status === 403) {
    // Primary kota bitti
    if (res.headers.get("x-ratelimit-remaining") === "0") return true;
    // Secondary limit: sunucu ne zaman tekrar deneyeceğimizi söylüyorsa geçicidir
    if (res.headers.get("retry-after") !== null) return true;
    // Son çare: gövde açıkça secondary limit diyorsa. `clone()` — asıl yanıtın
    // gövdesi çağıran için okunmamış kalmalı.
    try {
      const body = await res.clone().text();
      if (/secondary rate limit|abuse detection/i.test(body)) return true;
    } catch {
      // gövde okunamadı → kalıcı hata varsay
    }
  }

  return false;
}

/** Retry-After (saniye) → ms; yoksa x-ratelimit-reset; yoksa üstel backoff (tavanlı). */
function retryDelayMs(res: Response, attempt: number): number {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_BACKOFF_MS);
    }
  }

  const reset = res.headers.get("x-ratelimit-reset");
  if (reset !== null) {
    const resetMs = Number(reset) * 1000 - Date.now();
    if (Number.isFinite(resetMs) && resetMs > 0) {
      return Math.min(resetMs, MAX_BACKOFF_MS);
    }
  }

  return Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

/**
 * #179: GitHub rate-limit (429 / secondary limit) ve geçici 5xx durumlarında
 * ÜST SINIRLI retry yapan fetch sarmalayıcısı. `Retry-After` / `x-ratelimit-reset`
 * başlıklarına saygı duyar. Sınır aşılırsa son yanıt döner; çağıran hatayı üretir.
 */
async function githubFetch(url: string, init?: RequestInit): Promise<Response> {
  let lastRes: Response | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // #218 review: Asılı kalan istek provisioning'i süresiz bloke etmesin.
    const res = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    lastRes = res;

    if (!(await isRetryable(res)) || attempt === MAX_ATTEMPTS) {
      return res;
    }

    const waitMs = retryDelayMs(res, attempt);
    logger.warn("GitHub API rate-limit/geçici hata — yeniden denenecek", {
      url,
      status: res.status,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      waitMs,
    });
    await sleep(waitMs);
  }

  return lastRes as Response;
}

export type GitHubRepoResult = {
  repoUrl: string;
  owner: string;
  repo: string;
  /** #179: Repo bu çağrıda mı açıldı, yoksa zaten var mıydı (422 → yeniden kullanıldı)? */
  alreadyExisted: boolean;
};

export type GitHubMilestoneResult = {
  milestoneNumber: number;
  htmlUrl: string;
  /** #179: Aynı başlıklı milestone zaten varsa yeniden kullanıldı. */
  alreadyExisted: boolean;
};

export type GitHubIssueResult = {
  issueNumber: number;
  htmlUrl: string;
};

/**
 * Belirtilen organizasyon veya kullanıcı altında yeni bir GitHub reposu oluşturur.
 */
export async function createGitHubRepository(params: {
  orgOrOwner: string;
  repoName: string;
  description: string;
  isPrivate?: boolean;
}): Promise<GitHubRepoResult> {
  const { orgOrOwner, repoName, description, isPrivate = true } = params;
  const headers = getHeaders();

  const payload = {
    name: repoName,
    description,
    private: isPrivate,
    auto_init: true,
  };

  // Önce organizasyon reposu olarak oluşturmayı dene
  let res = await githubFetch(`${GITHUB_API_BASE}/orgs/${encodeURIComponent(orgOrOwner)}/repos`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  // 404 dönerse org değil kişisel kullanıcı hesabıdır, /user/repos ile dene
  if (res.status === 404) {
    res = await githubFetch(`${GITHUB_API_BASE}/user/repos`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  // 422: Repo zaten var olabilir → idempotent yeniden kullanım
  if (res.status === 422) {
    const existingRes = await githubFetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(orgOrOwner)}/${encodeURIComponent(repoName)}`, {
      headers,
    });
    if (existingRes.ok) {
      const existingData = await existingRes.json();
      return {
        repoUrl: existingData.html_url,
        owner: existingData.owner?.login || orgOrOwner,
        repo: existingData.name || repoName,
        alreadyExisted: true,
      };
    }
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    logger.error("GitHub repo oluşturulamadı", { status: res.status, errorBody, repoName });
    throw new Error(`GitHub repo oluşturulamadı (HTTP ${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return {
    repoUrl: data.html_url,
    owner: data.owner?.login || orgOrOwner,
    repo: data.name || repoName,
    alreadyExisted: false,
  };
}

/**
 * Belirtilen repoda bir Milestone (Faz) oluşturur.
 */
export async function createGitHubMilestone(params: {
  owner: string;
  repo: string;
  title: string;
  description?: string;
}): Promise<GitHubMilestoneResult> {
  const { owner, repo, title, description } = params;
  const headers = getHeaders();

  const res = await githubFetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      description: description || undefined,
      state: "open",
    }),
  });

  // 422: Aynı başlıklı milestone zaten varsa listele ve bul (idempotent)
  if (res.status === 422) {
    const listRes = await githubFetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones?state=all`, {
      headers,
    });
    if (listRes.ok) {
      const milestones = (await listRes.json()) as Array<{ title: string; number: number; html_url: string }>;
      const match = milestones.find((m) => m.title === title);
      if (match) {
        return {
          milestoneNumber: match.number,
          htmlUrl: match.html_url,
          alreadyExisted: true,
        };
      }
    }
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    logger.error("GitHub milestone oluşturulamadı", { status: res.status, errorBody, title });
    throw new Error(`GitHub milestone oluşturulamadı (HTTP ${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return {
    milestoneNumber: data.number,
    htmlUrl: data.html_url,
    alreadyExisted: false,
  };
}

/**
 * Belirtilen repoda Milestone'a bağlı bir Issue oluşturur.
 */
export async function createGitHubIssue(params: {
  owner: string;
  repo: string;
  title: string;
  body: string;
  milestoneNumber?: number;
}): Promise<GitHubIssueResult> {
  const { owner, repo, title, body, milestoneNumber } = params;
  const headers = getHeaders();

  const res = await githubFetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      body,
      milestone: milestoneNumber,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    logger.error("GitHub issue oluşturulamadı", { status: res.status, errorBody, title });
    throw new Error(`GitHub issue oluşturulamadı (HTTP ${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return {
    issueNumber: data.number,
    htmlUrl: data.html_url,
  };
}

/**
 * #179 review: Kayıtlı bir issue URL'inin GitHub'da HÂLÂ AÇIK olduğundan emin olur.
 *
 * Neden: Bir önceki denemede telafi (veya elle) kapatılmış bir issue'nun URL'i DB'de
 * kayıtlıysa, idempotent re-run onu atlar ve öğrenci **kapalı** bir göreve yönlenir.
 * Bu fonksiyon kapalıysa yeniden açar. Best-effort: hata fırlatmaz.
 *
 * @returns `true` → açık (veya açıldı), `false` → durum belirlenemedi/açılamadı.
 */
export async function ensureGitHubIssueOpen(params: {
  owner: string;
  repo: string;
  issueUrl: string;
}): Promise<boolean> {
  const { owner, repo, issueUrl } = params;
  const issueNumber = parseIssueNumber(issueUrl);
  if (issueNumber === null) return false;

  try {
    const base = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`;
    const res = await githubFetch(base, { headers: getHeaders() });
    if (!res.ok) return false;

    const data = (await res.json()) as { state?: string };
    if (data.state !== "closed") return true; // zaten açık

    const reopen = await githubFetch(base, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ state: "open" }),
    });
    if (!reopen.ok) {
      logger.warn("Kapalı issue yeniden açılamadı", { status: reopen.status, issueNumber, repo });
      return false;
    }
    logger.info("Kapalı issue yeniden açıldı (idempotent re-run)", { issueNumber, repo });
    return true;
  } catch (err) {
    logger.warn("Issue durumu kontrol edilemedi", { issueUrl, err });
    return false;
  }
}

/** `https://github.com/<owner>/<repo>/issues/<n>` → n (yoksa null). */
export function parseIssueNumber(issueUrl: string): number | null {
  const match = /\/issues\/(\d+)(?:[?#].*)?$/.exec(issueUrl.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * #218 review: Yeniden kullanılan (422 → alreadyExisted) bir milestone KAPALI olabilir
 * — önceki telafi veya elle kapatma. Öğrenci kapalı bir faza yönlenmesin diye açar.
 * Best-effort: hata fırlatmaz.
 */
export async function ensureGitHubMilestoneOpen(params: {
  owner: string;
  repo: string;
  milestoneNumber: number;
}): Promise<boolean> {
  const { owner, repo, milestoneNumber } = params;
  try {
    const base = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones/${milestoneNumber}`;
    const res = await githubFetch(base, { headers: getHeaders() });
    if (!res.ok) return false;

    const data = (await res.json()) as { state?: string };
    if (data.state !== "closed") return true;

    const reopen = await githubFetch(base, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ state: "open" }),
    });
    if (!reopen.ok) {
      logger.warn("Kapalı milestone yeniden açılamadı", { status: reopen.status, milestoneNumber, repo });
      return false;
    }
    logger.info("Kapalı milestone yeniden açıldı (idempotent re-run)", { milestoneNumber, repo });
    return true;
  } catch (err) {
    logger.warn("Milestone durumu kontrol edilemedi", { milestoneNumber, repo, err });
    return false;
  }
}

/**
 * #179 telafi: Bu çalışmada açılan issue'yu kapatır (best-effort — hata fırlatmaz).
 *
 * Repo/milestone SİLİNMEZ: repo öğrenci çalışması içerebilir ve idempotent yeniden
 * deneme onu tekrar kullanır. Amaç, yarım kalan provisioning'de "açık görev" gibi
 * görünen artıkları kapatmak.
 */
export async function closeGitHubIssue(params: {
  owner: string;
  repo: string;
  issueNumber: number;
}): Promise<boolean> {
  const { owner, repo, issueNumber } = params;
  try {
    const res = await githubFetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ state: "closed", state_reason: "not_planned" }),
      },
    );
    if (!res.ok) {
      logger.warn("Telafi: GitHub issue kapatılamadı", { status: res.status, issueNumber, repo });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn("Telafi: GitHub issue kapatma hatası", { issueNumber, repo, err });
    return false;
  }
}

/**
 * #179 telafi: Bu çalışmada açılan milestone'u kapatır (best-effort).
 */
export async function closeGitHubMilestone(params: {
  owner: string;
  repo: string;
  milestoneNumber: number;
}): Promise<boolean> {
  const { owner, repo, milestoneNumber } = params;
  try {
    const res = await githubFetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones/${milestoneNumber}`,
      {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ state: "closed" }),
      },
    );
    if (!res.ok) {
      logger.warn("Telafi: GitHub milestone kapatılamadı", { status: res.status, milestoneNumber, repo });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn("Telafi: GitHub milestone kapatma hatası", { milestoneNumber, repo, err });
    return false;
  }
}
