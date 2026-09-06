import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #349 — admin kuyruğu ve karar ucu.
 *
 * Kilitlenen sözleşme: repoyu açan karar YALNIZCA admin oturumundan geçer.
 * Mentör rolü bu uçlara erişemez — talep akışının tüm anlamı bu sınır.
 */

const { requireAuthMock, kuyrukMock, kararMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  kuyrukMock: vi.fn(),
  kararMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/workspace-requests/server/talep", () => ({
  bekleyenTalepleriGetir: kuyrukMock,
  talebiKararaBagla: kararMock,
}));

import { GET } from "./route";
import { POST } from "./[requestId]/route";

const params = Promise.resolve({ requestId: "wr1" });
const istek = (govde: unknown) =>
  new Request("http://t", { method: "POST", body: JSON.stringify(govde) });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "admin-1", role: "ADMIN" } },
  });
  kuyrukMock.mockResolvedValue([]);
  kararMock.mockResolvedValue({ ok: true, durum: "APPROVED", kurulumBaslatildi: true });
});

describe("GET — kuyruk", () => {
  it("ADMIN değilse kuyruk okunamaz", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    const res = await GET();

    expect(res.status).toBe(403);
    expect(kuyrukMock).not.toHaveBeenCalled();
  });

  it("bekleyen talepleri döner", async () => {
    kuyrukMock.mockResolvedValue([{ id: "wr1" }]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).talepler).toHaveLength(1);
  });

  it("DB hatası → 500, ham hata sızmaz", async () => {
    kuyrukMock.mockRejectedValue(new Error("connection refused to 10.0.0.5"));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("10.0.0.5");
  });
});

describe("POST — karar", () => {
  it("ADMIN değilse karar verilemez — kurulum tetiklenmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    const res = await POST(istek({ onay: true }), { params });

    expect(res.status).toBe(403);
    expect(kararMock).not.toHaveBeenCalled();
  });

  it("onayda 202 döner (kurulum arka planda)", async () => {
    const res = await POST(istek({ onay: true }), { params });

    expect(res.status).toBe(202);
    expect(kararMock).toHaveBeenCalledWith({
      requestId: "wr1",
      adminUserId: "admin-1",
      onay: true,
      adminNote: null,
    });
  });

  it("redde 200 döner", async () => {
    kararMock.mockResolvedValue({ ok: true, durum: "REJECTED", kurulumBaslatildi: false });

    const res = await POST(istek({ onay: false, adminNote: "gerekçe" }), { params });

    expect(res.status).toBe(200);
  });

  it("gerekçesiz redde 400", async () => {
    kararMock.mockResolvedValue({ ok: false, neden: "gerekce-gerekli" });

    const res = await POST(istek({ onay: false }), { params });

    expect(res.status).toBe(400);
  });

  it("zaten karara bağlanmışsa 409 — 500 DEĞİL", async () => {
    // İstek geçerliydi, durum uygun değildi; hata izlemede gürültü yapmasın.
    kararMock.mockResolvedValue({ ok: false, neden: "zaten-karara-baglanmis" });

    const res = await POST(istek({ onay: true }), { params });

    expect(res.status).toBe(409);
  });

  it("kurulum başlatılamazsa nedeni admin'e taşınır", async () => {
    kararMock.mockResolvedValue({
      ok: false,
      neden: "kurulum-suruyor",
      mesaj: "GITHUB_TOKEN tanımlı değil.",
    });

    const res = await POST(istek({ onay: true }), { params });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("GITHUB_TOKEN");
  });

  it("onay alanı yoksa 400", async () => {
    const res = await POST(istek({}), { params });

    expect(res.status).toBe(400);
    expect(kararMock).not.toHaveBeenCalled();
  });
});
