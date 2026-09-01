import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

const { prismaMock, isleMock, limiterCheckMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: { processedWebhook: { create: vi.fn() } },
  isleMock: vi.fn(),
  limiterCheckMock: vi.fn(),
  loggerMock: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: (...a: unknown[]) => limiterCheckMock(...a) }),
}));
vi.mock("@/features/github/server/webhook-isle", () => ({
  issueKapandiginiIsle: (...a: unknown[]) => isleMock(...a),
}));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(basliklar) }));

import { POST } from "./route";

const SIR = "test-sir";
let basliklar: Headers;

function istek(govde: unknown, ek: Record<string, string> = {}, sir = SIR) {
  const ham = JSON.stringify(govde);
  const imza = "sha256=" + crypto.createHmac("sha256", sir).update(ham, "utf8").digest("hex");
  basliklar = new Headers({
    "x-hub-signature-256": imza,
    "x-github-delivery": "teslimat-1",
    "x-github-event": "issues",
    ...ek,
  });
  return new Request("http://t", { method: "POST", body: ham });
}

const kapanmaOlayi = { action: "closed", issue: { html_url: "https://github.com/o/r/issues/1" } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", SIR);
  limiterCheckMock.mockResolvedValue({ allowed: true, remaining: 59, retryAfterSeconds: 0 });
  prismaMock.processedWebhook.create.mockResolvedValue({});
  isleMock.mockResolvedValue({ islendi: true, aciklama: "adım COMPLETED yapıldı" });
});

describe("imza koruması", () => {
  it("geçerli imzalı kapanma olayını işler", async () => {
    const res = await POST(istek(kapanmaOlayi));

    expect(res.status).toBe(200);
    expect(isleMock).toHaveBeenCalledOnce();
  });

  // EN KRİTİK: uç public. İmza geçmezse HİÇBİR iş yapılmamalı.
  it("YANLIŞ imzada 401 döner ve olay İŞLENMEZ", async () => {
    const res = await POST(istek(kapanmaOlayi, {}, "yanlis-sir"));

    expect(res.status).toBe(401);
    expect(isleMock).not.toHaveBeenCalled();
    // Replay kaydı da atılmamalı — geçersiz istek teslimat kimliğini tüketmesin.
    expect(prismaMock.processedWebhook.create).not.toHaveBeenCalled();
  });

  it("imza başlığı yoksa 401", async () => {
    const r = istek(kapanmaOlayi);
    basliklar.delete("x-hub-signature-256");

    expect((await POST(r)).status).toBe(401);
    expect(isleMock).not.toHaveBeenCalled();
  });

  it("sır tanımlı değilse 503 — sessiz başarı GÖSTERMEZ", async () => {
    // Aksi halde webhook kurulu ama hiçbir şey yapmıyor olurdu, kimse fark etmezdi.
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "");

    const res = await POST(istek(kapanmaOlayi));

    expect(res.status).toBe(503);
    expect(loggerMock.error).toHaveBeenCalled();
  });
});

describe("replay koruması", () => {
  it("aynı teslimat ikinci kez İŞLENMEZ", async () => {
    // Benzersizlik ihlali = zaten işlenmiş.
    prismaMock.processedWebhook.create.mockRejectedValue(new Error("unique violation"));

    const res = await POST(istek(kapanmaOlayi));
    const govde = await res.json();

    expect(res.status).toBe(200);
    expect(govde.tekrar).toBe(true);
    expect(isleMock).not.toHaveBeenCalled();
  });

  it("teslimat kimliği yoksa 400", async () => {
    const r = istek(kapanmaOlayi);
    basliklar.delete("x-github-delivery");

    expect((await POST(r)).status).toBe(400);
    expect(isleMock).not.toHaveBeenCalled();
  });
});

describe("olay ayrımı", () => {
  it("ilgilenilmeyen olay sessizce 200 döner", async () => {
    // GitHub ardışık hata alan webhook'u DEVRE DIŞI bırakır; 200 dönmeliyiz.
    const res = await POST(istek(kapanmaOlayi, { "x-github-event": "push" }));

    expect(res.status).toBe(200);
    expect(isleMock).not.toHaveBeenCalled();
  });

  it("kapanma olmayan issue olayı işlenmez", async () => {
    const res = await POST(istek({ action: "opened", issue: { html_url: "u" } }));

    expect(res.status).toBe(200);
    expect(isleMock).not.toHaveBeenCalled();
  });

  it("PR yalnızca MERGE edilmişse işlenir", async () => {
    const kapali = { action: "closed", pull_request: { html_url: "u", merged: false } };
    await POST(istek(kapali, { "x-github-event": "pull_request" }));
    expect(isleMock).not.toHaveBeenCalled();

    const merged = { action: "closed", pull_request: { html_url: "u", merged: true } };
    await POST(istek(merged, { "x-github-event": "pull_request" }));
    expect(isleMock).toHaveBeenCalledOnce();
  });
});

describe("dayanıklılık", () => {
  it("işleme hatasında 500 DEĞİL 200 döner (webhook devre dışı kalmasın)", async () => {
    isleMock.mockRejectedValue(new Error("db patladı"));

    const res = await POST(istek(kapanmaOlayi));

    expect(res.status).toBe(200);
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("rate-limit aşılınca 429 ve imza HİÇ hesaplanmaz", async () => {
    limiterCheckMock.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 30 });

    const res = await POST(istek(kapanmaOlayi));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(isleMock).not.toHaveBeenCalled();
  });
});
