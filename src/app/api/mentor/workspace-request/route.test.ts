import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #349 — mentör talep ucu.
 *
 * En kritik iddia: bu uç ROL OLARAK mentöre açık ama YETKİ olarak dar —
 * mentör yalnız kendi öğrencisine talep açabilir ve hiçbir koşulda repo
 * kurulumunu tetiklemez.
 */

const { requireAuthMock, talepOlusturMock, sonTalepMock, erisimMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  talepOlusturMock: vi.fn(),
  sonTalepMock: vi.fn(),
  erisimMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/workspace-requests/server/talep", () => ({
  talepOlustur: talepOlusturMock,
  atamaninSonTalebi: sonTalepMock,
  atamayaErisebilirMi: erisimMock,
}));

import { POST, GET } from "./route";

const istek = (govde: unknown) =>
  new Request("http://t/api/mentor/workspace-request", {
    method: "POST",
    body: JSON.stringify(govde),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "mentor-1", role: "MENTOR" } },
  });
  talepOlusturMock.mockResolvedValue({ ok: true, requestId: "wr1" });
  erisimMock.mockResolvedValue(true);
  sonTalepMock.mockResolvedValue(null);
});

describe("POST — talep açma", () => {
  it("MENTOR değilse talep açılmaz", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    const res = await POST(istek({ assignedProjectId: "ap1" }));

    expect(res.status).toBe(403);
    expect(talepOlusturMock).not.toHaveBeenCalled();
  });

  it("talebi OTURUMDAKİ mentör kimliğiyle açar", async () => {
    // Gövdeden gelen bir mentör kimliğine asla güvenilmemeli.
    const res = await POST(istek({ assignedProjectId: "ap1", mentorNote: "hazır" }));

    expect(res.status).toBe(201);
    expect(talepOlusturMock).toHaveBeenCalledWith({
      assignedProjectId: "ap1",
      mentorUserId: "mentor-1",
      mentorNote: "hazır",
    });
  });

  it("geçersiz gövde → 400", async () => {
    const res = await POST(istek({}));
    expect(res.status).toBe(400);
    expect(talepOlusturMock).not.toHaveBeenCalled();
  });

  it("bozuk JSON'da çökmez → 400", async () => {
    const res = await POST(
      new Request("http://t", { method: "POST", body: "{bozuk" }),
    );
    expect(res.status).toBe(400);
  });

  it.each([
    ["yetki-yok", 403],
    ["atama-yok", 404],
    ["yol-haritasi-yok", 400],
    ["zaten-kurulu", 409],
    ["zaten-bekliyor", 409],
  ])("%s → %i", async (neden, durum) => {
    talepOlusturMock.mockResolvedValue({ ok: false, neden });

    const res = await POST(istek({ assignedProjectId: "ap1" }));

    expect(res.status).toBe(durum);
    // Mesaj Türkçe ve kullanıcıya gösterilebilir olmalı.
    expect(typeof (await res.json()).error).toBe("string");
  });
});

describe("GET — atamanın son talebi", () => {
  it("başka mentörün atamasını okuyamaz", async () => {
    // Atama kimliğini bilen bir mentör, başkasının öğrencisinin talep
    // geçmişini görmemeli.
    erisimMock.mockResolvedValue(false);

    const res = await GET(new Request("http://t?assignedProjectId=ap1"));

    expect(res.status).toBe(403);
    expect(sonTalepMock).not.toHaveBeenCalled();
  });

  it("assignedProjectId yoksa 400", async () => {
    const res = await GET(new Request("http://t"));
    expect(res.status).toBe(400);
  });

  it("yetkili mentöre talebi döner", async () => {
    sonTalepMock.mockResolvedValue({ id: "wr1", status: "PENDING" });

    const res = await GET(new Request("http://t?assignedProjectId=ap1"));

    expect(res.status).toBe(200);
    expect((await res.json()).talep).toMatchObject({ status: "PENDING" });
  });
});
