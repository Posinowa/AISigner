// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * POST /api/messages/typing (#354).
 *
 * ⚠️ EN ÖNEMLİ GARANTİ: "yazıyor" sinyali MESAJLAŞMA YETKİSİNİN aynısını
 * ister. Aksi halde uç, "bu kullanıcı var mı / şu an aktif mi" sorularına
 * yetkisiz yanıt veren bir yan kanala dönüşürdü.
 */

const { authMock, erisimMock, yaziyorMock, limiterMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  erisimMock: vi.fn(),
  yaziyorMock: { isaretle: vi.fn(), durdur: vi.fn() },
  limiterMock: { check: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guard", () => ({ requireAuth: authMock }));
vi.mock("@/features/messaging/server/erisim", () => ({
  verifyConversationAccess: erisimMock,
}));
vi.mock("@/features/messaging/server/yaziyor", () => ({
  yaziyorIsaretle: yaziyorMock.isaretle,
  yaziyorDurdur: yaziyorMock.durdur,
}));
vi.mock("@/lib/rate-limit", () => ({ createRateLimiter: () => limiterMock }));

import { POST } from "./route";
import { NextResponse } from "next/server";

const req = (body: unknown) =>
  new Request("http://x/api/messages/typing", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "me", role: "STUDENT" } },
  });
  erisimMock.mockResolvedValue(true);
  limiterMock.check.mockResolvedValue({ allowed: true });
  yaziyorMock.isaretle.mockResolvedValue(undefined);
  yaziyorMock.durdur.mockResolvedValue(undefined);
});

describe("yetki", () => {
  it("oturum yoksa guard'ın yanıtı döner", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: "yok" }, { status: 401 }),
    });

    const res = await POST(req({ to: "u2", yaziyor: true }));
    expect(res.status).toBe(401);
    expect(yaziyorMock.isaretle).not.toHaveBeenCalled();
  });

  it("MESAJLAŞAMADIĞIN kişiye sinyal gönderilemez → 403", async () => {
    erisimMock.mockResolvedValue(false);

    const res = await POST(req({ to: "yabanci", yaziyor: true }));
    expect(res.status).toBe(403);
    expect(yaziyorMock.isaretle).not.toHaveBeenCalled();
  });

  it("erişim kontrolü mesajlaşmayla AYNI fonksiyonu kullanır", async () => {
    await POST(req({ to: "u2", yaziyor: true }));
    expect(erisimMock).toHaveBeenCalledWith("me", "u2", "STUDENT");
  });
});

describe("gövde", () => {
  it("geçersiz gövde → 400", async () => {
    const res = await POST(req({ to: "" }));
    expect(res.status).toBe(400);
    expect(yaziyorMock.isaretle).not.toHaveBeenCalled();
  });

  it("bozuk JSON → 400, çökmez", async () => {
    const res = await POST(
      new Request("http://x/api/messages/typing", { method: "POST", body: "{bozuk" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("davranış", () => {
  it("yaziyor:true → sinyal tazelenir", async () => {
    const res = await POST(req({ to: "u2", yaziyor: true }));
    expect(res.status).toBe(200);
    expect(yaziyorMock.isaretle).toHaveBeenCalledWith("me", "u2");
  });

  it("yaziyor:false → sinyal SİLİNİR", async () => {
    await POST(req({ to: "u2", yaziyor: false }));
    expect(yaziyorMock.durdur).toHaveBeenCalledWith("me", "u2");
    expect(yaziyorMock.isaretle).not.toHaveBeenCalled();
  });

  it("rate-limit SESSİZ geçer — kozmetik sinyal hata göstermemeli", async () => {
    limiterMock.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

    const res = await POST(req({ to: "u2", yaziyor: true }));
    expect(res.status).toBe(200);
    expect(yaziyorMock.isaretle).not.toHaveBeenCalled();
  });

  it("rate-limit YETKİDEN ÖNCE — yetkisiz istek de sayılmalı", async () => {
    limiterMock.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    await POST(req({ to: "u2", yaziyor: true }));
    expect(erisimMock).not.toHaveBeenCalled();
  });

  it("DB hatası mesajlaşmayı bozmaz", async () => {
    yaziyorMock.isaretle.mockRejectedValue(new Error("db down"));

    const res = await POST(req({ to: "u2", yaziyor: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false });
  });
});
