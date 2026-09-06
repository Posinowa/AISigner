// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * POST /api/mentor/steps/[stepId]/revizyon (#379).
 *
 * ⚠️ "yetki-yok" da 404 döner: başkasının adımının VAR OLDUĞU bile sızmasın.
 */

const { authMock, revizyonMock, senkMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revizyonMock: vi.fn(),
  senkMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guard", () => ({ requireAuth: authMock }));
vi.mock("@/features/roadmap/server/revizyon", () => ({ revizyonIste: revizyonMock }));
vi.mock("@/features/github/server/revizyon-senk", () => ({
  revizyonuGitHubaYansit: senkMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("next/server", async () => {
  const gercek = await vi.importActual<typeof import("next/server")>("next/server");
  // `after` senkron çalışsın ki arka plan işini test edebilelim.
  return { ...gercek, after: (f: () => unknown) => f() };
});

import { POST } from "./route";
import { NextResponse } from "next/server";

const params = Promise.resolve({ stepId: "st-1" });
const istek = (govde: unknown) =>
  new Request("http://x/api/mentor/steps/st-1/revizyon", {
    method: "POST",
    body: JSON.stringify(govde),
  });

const GECERLI = { gerekce: "Testler eksik, lütfen kapsamı genişlet." };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "men-1", role: "MENTOR" } },
  });
  revizyonMock.mockResolvedValue({ ok: true, stepId: "st-1" });
  senkMock.mockResolvedValue({ yenidenAcilan: 1 });
});

describe("yetki ve gövde", () => {
  it("oturum yoksa guard'ın yanıtı döner", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: "yok" }, { status: 401 }),
    });
    const res = await POST(istek(GECERLI), { params });
    expect(res.status).toBe(401);
    expect(revizyonMock).not.toHaveBeenCalled();
  });

  it("uç yalnız MENTOR ve ADMIN'e açık", async () => {
    await POST(istek(GECERLI), { params });
    expect(authMock).toHaveBeenCalledWith(["MENTOR", "ADMIN"]);
  });

  it("GEREKÇE 10 karakterden kısaysa 400", async () => {
    const res = await POST(istek({ gerekce: "kısa" }), { params });
    expect(res.status).toBe(400);
    expect(revizyonMock).not.toHaveBeenCalled();
  });

  it("bozuk JSON → 400, çökmez", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: "{bozuk" }),
      { params },
    );
    expect(res.status).toBe(400);
  });
});

describe("hata eşlemesi", () => {
  it.each([
    ["adim-yok", 404],
    ["yetki-yok", 404],
    ["tamamlanmamis", 400],
    ["gerekce-gerekli", 400],
    ["mezun", 403],
  ])("%s → %i", async (neden, durum) => {
    revizyonMock.mockResolvedValue({ ok: false, neden });
    const res = await POST(istek(GECERLI), { params });
    expect(res.status).toBe(durum);
  });

  it("yetki-yok mesajı adımın VARLIĞINI sızdırmaz", async () => {
    revizyonMock.mockResolvedValue({ ok: false, neden: "yetki-yok" });
    const res = await POST(istek(GECERLI), { params });
    expect((await res.json()).error).toBe("Adım bulunamadı.");
  });
});

describe("başarı", () => {
  it("200 döner ve gerekçeyi sunucu katmanına geçirir", async () => {
    const res = await POST(istek(GECERLI), { params });

    expect(res.status).toBe(200);
    expect(revizyonMock).toHaveBeenCalledWith({
      stepId: "st-1",
      isteyenUserId: "men-1",
      isteyenRol: "MENTOR",
      gerekce: GECERLI.gerekce,
    });
  });

  it("GitHub senkronu ARKA PLANDA tetiklenir", async () => {
    await POST(istek(GECERLI), { params });
    expect(senkMock).toHaveBeenCalledWith({ stepId: "st-1", gerekce: GECERLI.gerekce });
  });

  it("GitHub senkronu PATLASA DA revizyon başarılı döner", async () => {
    senkMock.mockRejectedValue(new Error("gh down"));

    const res = await POST(istek(GECERLI), { params });

    // Platform durumu tek doğru kaynak; ağ hatası revizyonu geri almamalı.
    expect(res.status).toBe(200);
  });
});
