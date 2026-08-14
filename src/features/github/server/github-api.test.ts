import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createGitHubIssue, isGitHubConfigured } from "./github-api";

// #201 dersi: env'i modül seviyesinde set etmek worker'ı kirletir. Yalnız bu
// suite süresince set edip sonra eski değerine döndürüyoruz.
const PREV_TOKEN = process.env.GITHUB_TOKEN;

beforeAll(() => {
  process.env.GITHUB_TOKEN = "test-token";
});

afterAll(() => {
  if (PREV_TOKEN === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = PREV_TOKEN;
});

/** Verilen status ile sahte Response üretir (retry-after: 0 → test beklemez). */
function res(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const issueParams = { owner: "Posinowa", repo: "demo", title: "T", body: "B" };

describe("github-api — rate-limit retry (#179 review)", () => {
  it("GITHUB_TOKEN varsa isGitHubConfigured() → true", () => {
    expect(isGitHubConfigured()).toBe(true);
  });

  it("429 sonrası yeniden dener ve başarılı olur", async () => {
    fetchMock
      .mockResolvedValueOnce(res(429, {}, { "retry-after": "0" }))
      .mockResolvedValueOnce(res(201, { number: 5, html_url: "https://gh/issues/5" }));

    const result = await createGitHubIssue(issueParams);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.issueNumber).toBe(5);
  });

  it("secondary rate-limit (403 + remaining=0) yeniden denenir", async () => {
    fetchMock
      .mockResolvedValueOnce(res(403, {}, { "retry-after": "0", "x-ratelimit-remaining": "0" }))
      .mockResolvedValueOnce(res(201, { number: 6, html_url: "https://gh/issues/6" }));

    const result = await createGitHubIssue(issueParams);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.issueNumber).toBe(6);
  });

  it("5xx geçici hata yeniden denenir", async () => {
    fetchMock
      .mockResolvedValueOnce(res(502, {}, { "retry-after": "0" }))
      .mockResolvedValueOnce(res(201, { number: 7, html_url: "https://gh/issues/7" }));

    const result = await createGitHubIssue(issueParams);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.issueNumber).toBe(7);
  });

  it("ÜST SINIR: sürekli 429 → sınırsız denemez, hata fırlatır", async () => {
    fetchMock.mockResolvedValue(res(429, {}, { "retry-after": "0" }));

    await expect(createGitHubIssue(issueParams)).rejects.toThrow(/HTTP 429/);

    // MAX_ATTEMPTS = 3 → sonsuz döngü yok
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("kalıcı hata (401) yeniden DENENMEZ — tek çağrı", async () => {
    fetchMock.mockResolvedValue(res(401, { message: "Bad credentials" }));

    await expect(createGitHubIssue(issueParams)).rejects.toThrow(/HTTP 401/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
