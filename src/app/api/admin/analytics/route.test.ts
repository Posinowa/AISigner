// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #331 — analitik uçlarının YETKİ SINIRLARI.
 *
 * En kritik iddia: mentörün kapsamı OTURUMDAN gelir. İstekten alınsaydı,
 * herhangi bir mentör başka bir mentörün öğrencilerini, yanıt süresini ve
 * "gözden geçirilmeli" listesini okuyabilirdi — bunlar insanlar hakkında
 * hassas değerlendirmeler.
 */

const { requireAuthMock, panelMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  panelMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/analytics/server/panel", () => ({
  panelVerisiGetir: panelMock,
}));

import { GET as adminGET } from "./route";
import { GET as mentorGET } from "../../mentor/analytics/route";

const bosVeri = { darbogazlar: [], yanitSureleri: [], riskliler: [], uretildi: "2026-09-01" };

beforeEach(() => {
  vi.clearAllMocks();
  panelMock.mockResolvedValue(bosVeri);
});

describe("admin ucu", () => {
  it("ADMIN değilse veri dönmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    const res = await adminGET();

    expect(res.status).toBe(403);
    expect(panelMock).not.toHaveBeenCalled();
  });

  it("ADMIN rolü ister", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "a1", role: "ADMIN" } },
    });

    await adminGET();

    expect(requireAuthMock).toHaveBeenCalledWith("ADMIN");
  });

  it("kapsamı DARALTMADAN çağırır (platform geneli)", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "a1", role: "ADMIN" } },
    });

    const res = await adminGET();

    expect(res.status).toBe(200);
    expect(panelMock).toHaveBeenCalledWith();
  });

  it("hata durumunda ham hata sızmaz", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "a1", role: "ADMIN" } },
    });
    panelMock.mockRejectedValue(new Error("relation does not exist: secret_table"));

    const res = await adminGET();

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret_table");
  });
});

describe("mentör ucu", () => {
  it("MENTOR değilse veri dönmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    const res = await mentorGET();

    expect(res.status).toBe(403);
    expect(panelMock).not.toHaveBeenCalled();
  });

  it("kapsamı OTURUMDAKİ mentöre daraltır", async () => {
    // Bu testin varlık sebebi: kapsam istekten alınsaydı, mentör başkasının
    // öğrencilerini okuyabilirdi.
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "mentor-1", role: "MENTOR" } },
    });

    const res = await mentorGET();

    expect(res.status).toBe(200);
    expect(panelMock).toHaveBeenCalledWith("mentor-1");
  });

  it("hata durumunda 500 döner", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "mentor-1", role: "MENTOR" } },
    });
    panelMock.mockRejectedValue(new Error("db"));

    expect((await mentorGET()).status).toBe(500);
  });
});
