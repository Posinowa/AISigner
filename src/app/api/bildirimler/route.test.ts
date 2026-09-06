// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * /api/bildirimler (#380).
 *
 * ⚠️ KAPSAM HER ZAMAN OTURUMDAN. `userId` istemciden alınmıyor; aksi halde
 * herkes başkasının bildirimlerini okuyabilirdi.
 */

const { authMock, getirMock, sayiMock, okunduMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getirMock: vi.fn(),
  sayiMock: vi.fn(),
  okunduMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guard", () => ({ requireAuth: authMock }));
vi.mock("@/features/bildirim/server/bildirim", () => ({
  bildirimleriGetir: getirMock,
  okunmamisSayisi: sayiMock,
  okunduIsaretle: okunduMock,
}));

import { GET, POST } from "./route";
import { NextResponse } from "next/server";

const istek = (govde: unknown) =>
  new Request("http://x/api/bildirimler", { method: "POST", body: JSON.stringify(govde) });

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "u1", role: "STUDENT" } },
  });
  getirMock.mockResolvedValue([{ id: "n1" }]);
  sayiMock.mockResolvedValue(2);
  okunduMock.mockResolvedValue(2);
});

describe("GET", () => {
  it("oturum yoksa guard'ın yanıtı döner", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: "yok" }, { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(getirMock).not.toHaveBeenCalled();
  });

  it("⚠️ kapsam OTURUMDAN gelir", async () => {
    await GET();

    expect(getirMock).toHaveBeenCalledWith("u1");
    expect(sayiMock).toHaveBeenCalledWith("u1");
  });

  it("liste ve okunmamış sayısını birlikte döner", async () => {
    const res = await GET();
    expect(await res.json()).toEqual({ bildirimler: [{ id: "n1" }], okunmamis: 2 });
  });

  it("üç rol de erişebilir", async () => {
    await GET();
    expect(authMock).toHaveBeenCalledWith(["ADMIN", "MENTOR", "STUDENT"]);
  });
});

describe("POST — okundu işaretle", () => {
  it("⚠️ istemci userId GÖNDEREMEZ — kapsam oturumdan", async () => {
    await POST(istek({ ids: ["n1"], userId: "baskasi" }));

    expect(okunduMock).toHaveBeenCalledWith("u1", ["n1"]);
  });

  it("id verilmezse tümü okundu", async () => {
    await POST(istek({}));
    expect(okunduMock).toHaveBeenCalledWith("u1", undefined);
  });

  it("geçersiz gövde → 400", async () => {
    const res = await POST(istek({ ids: "dizi-degil" }));
    expect(res.status).toBe(400);
    expect(okunduMock).not.toHaveBeenCalled();
  });

  it("bozuk JSON → çökmez", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: "{bozuk" }));
    expect(res.status).toBe(200);
  });

  it("okunan sayısını döner", async () => {
    const res = await POST(istek({}));
    expect(await res.json()).toEqual({ ok: true, okunan: 2 });
  });
});
