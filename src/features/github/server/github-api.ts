import { logger } from "@/lib/logger";

const GITHUB_API_BASE = "https://api.github.com";

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

export type GitHubRepoResult = {
  repoUrl: string;
  owner: string;
  repo: string;
};

export type GitHubMilestoneResult = {
  milestoneNumber: number;
  htmlUrl: string;
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
  let res = await fetch(`${GITHUB_API_BASE}/orgs/${encodeURIComponent(orgOrOwner)}/repos`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  // 404 dönerse org değil kişisel kullanıcı hesabıdır, /user/repos ile dene
  if (res.status === 404) {
    res = await fetch(`${GITHUB_API_BASE}/user/repos`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  // 422: Repo zaten var olabilir
  if (res.status === 422) {
    const existingRes = await fetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(orgOrOwner)}/${encodeURIComponent(repoName)}`, {
      headers,
    });
    if (existingRes.ok) {
      const existingData = await existingRes.json();
      return {
        repoUrl: existingData.html_url,
        owner: existingData.owner?.login || orgOrOwner,
        repo: existingData.name || repoName,
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

  const res = await fetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      description: description || undefined,
      state: "open",
    }),
  });

  // 422: Aynı başlıklı milestone zaten varsa listele ve bul
  if (res.status === 422) {
    const listRes = await fetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones?state=all`, {
      headers,
    });
    if (listRes.ok) {
      const milestones = (await listRes.json()) as Array<{ title: string; number: number; html_url: string }>;
      const match = milestones.find((m) => m.title === title);
      if (match) {
        return {
          milestoneNumber: match.number,
          htmlUrl: match.html_url,
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

  const res = await fetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
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
