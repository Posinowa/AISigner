import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #328 — mentör önerisi ucu.
 *
 * En kritik iddia: bu uç ATAMA YAPMAZ. Öneriyi uygulamak admin'in ayrı bir
 * tıkı olmalı, çağrının yan etkisi değil.
 */

const { requireAuthMock, oneriMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  oneriMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/matching/server/eslestirme", () => ({
  mentorOnerisiUret: oneriMock,
}));

import { POST } from "./route";

const istek = (govde: unknown) =>
  new Request("http://t/api/admin/match-mentors", {
    method: "POST",
    body: JSON.stringify(govde),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "admin-1", role: "ADMIN" } },
  });
  oneriMock.mockResolvedValue({
    ok: true,
    oneriler: [],
    degerlendirilen: 2,
    analiziOlmayan: 0,
    rizasiOlmayan: 0,
  });
});

describe("yetki", () => {
  it("ADMIN değilse öneri üretilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    const res = await POST(istek({ studentId: "u1" }));

    expect(res.status).toBe(403);
    expect(oneriMock).not.toHaveBeenCalled();
  });

  it("tavan OTURUMDAKİ admin kimliğine bağlanır", async () => {
    // Gövdeden gelen bir admin kimliğine güvenilseydi tavan atlatılabilirdi.
    await POST(istek({ studentId: "u1", adminUserId: "baska" }));

    expect(oneriMock).toHaveBeenCalledWith({
      studentUserId: "u1",
      adminUserId: "admin-1",
    });
  });
});

describe("doğrulama ve hata eşlemesi", () => {
  it("studentId yoksa 400", async () => {
    const res = await POST(istek({}));
    expect(res.status).toBe(400);
    expect(oneriMock).not.toHaveBeenCalled();
  });

  it("bozuk JSON'da çökmez → 400", async () => {
    const res = await POST(new Request("http://t", { method: "POST", body: "{bozuk" }));
    expect(res.status).toBe(400);
  });

  it.each([
    ["ogrenci-yok", 404],
    ["profil-yok", 400],
    ["riza-yok", 403],
    ["aday-yok", 409],
    ["tavan-doldu", 429],
    ["ai-hatasi", 502],
  ])("%s → %i", async (neden, durum) => {
    oneriMock.mockResolvedValue({ ok: false, neden });

    const res = await POST(istek({ studentId: "u1" }));

    expect(res.status).toBe(durum);
    const govde = await res.json();
    expect(typeof govde.error).toBe("string");
    // İstemci nedeni ayırt edebilmeli (ör. rıza uyarısını farklı göstermek için).
    expect(govde.neden).toBe(neden);
  });

  it("başarıda eleme sayıları da döner", async () => {
    // "En uygun 3", adayların yarısı elenmişken yanıltıcı olur.
    oneriMock.mockResolvedValue({
      ok: true,
      oneriler: [{ mentorId: "m1" }],
      degerlendirilen: 1,
      analiziOlmayan: 3,
      rizasiOlmayan: 1,
    });

    const res = await POST(istek({ studentId: "u1" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      degerlendirilen: 1,
      analiziOlmayan: 3,
      rizasiOlmayan: 1,
    });
  });
});
