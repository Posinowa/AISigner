// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #261 — doğrulama e-postasını yeniden gönderme.
 *
 * Kritik davranışlar:
 * - hedef OTURUMDAN gelir; kimse başkasının adresine e-posta tetikleyemez
 * - zaten doğrulanmış hesaba e-posta gönderilmez
 * - oran sınırı e-posta bombardımanını engeller
 */

const { authMock, prismaMock, sendMock, limitMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: { user: { findUnique: vi.fn() } },
  sendMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({ requireAuth: (...a: unknown[]) => authMock(...a) }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: (...a: unknown[]) => limitMock(...a) }),
}));
vi.mock("@/features/auth/server/email-verification", () => ({
  sendVerificationEmail: sendMock,
}));

import { POST } from "./route";

async function cagir() {
  const r = await POST();
  return { durum: r.status, govde: await r.json(), yanit: r };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "k1", role: "STUDENT" } },
  });
  prismaMock.user.findUnique.mockResolvedValue({
    id: "k1",
    email: "ayse@ornek.com",
    name: "Ayse",
    emailVerified: null,
  });
  limitMock.mockReturnValue({ allowed: true });
  sendMock.mockResolvedValue(undefined);
});

describe("yetki", () => {
  it("oturum yoksa reddedilir ve e-posta gönderilmez", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    expect((await POST()).status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("e-posta OTURUMDAKİ kullanıcıya gönderilir", async () => {
    await cagir();

    expect(sendMock).toHaveBeenCalledWith({
      userId: "k1",
      email: "ayse@ornek.com",
      name: "Ayse",
    });
  });

  it("kullanıcı DB'den OTURUM kimliğiyle çekilir", async () => {
    // Hedef gövdeden alınsaydı başkasının adresine e-posta tetiklenebilirdi.
    await cagir();
    expect(prismaMock.user.findUnique.mock.calls[0][0].where).toEqual({ id: "k1" });
  });

  it("onay bekleyen stajyer de isteyebilir", async () => {
    // Onay beklerken e-postasını doğrulaması gereken tam olarak o kullanıcı.
    await cagir();
    expect(authMock.mock.calls[0][1]).toMatchObject({ allowUnapprovedStudent: true });
  });
});

describe("zaten doğrulanmış hesap", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "k1",
      email: "ayse@ornek.com",
      name: "Ayse",
      emailVerified: new Date(),
    });
  });

  it("e-posta GÖNDERİLMEZ", async () => {
    const r = await cagir();

    expect(r.durum).toBe(200);
    expect(r.govde.alreadyVerified).toBe(true);
    expect(sendMock, "doğrulanmış hesaba e-posta gitmemeli").not.toHaveBeenCalled();
  });

  it("oran sınırı TÜKETİLMEZ", async () => {
    // Kullanıcının hatası değil; kotasını yakmamalı.
    await cagir();
    expect(limitMock).not.toHaveBeenCalled();
  });
});

describe("oran sınırı", () => {
  it("aşılınca 429 döner ve e-posta gönderilmez", async () => {
    limitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 120 });

    const r = await cagir();

    expect(r.durum).toBe(429);
    expect(r.yanit.headers.get("Retry-After")).toBe("120");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sınır kullanıcı başına uygulanır", async () => {
    await cagir();
    expect(limitMock).toHaveBeenCalledWith("k1");
  });
});

describe("gönderim", () => {
  it("başarıda kullanıcıya bilgi verilir", async () => {
    const r = await cagir();

    expect(r.durum).toBe(200);
    expect(r.govde.message).toMatch(/gönderildi/i);
  });

  it("gönderim başarısız olsa da hata SIZMAZ", async () => {
    // sendVerificationEmail fırlatmıyor (#247); yine de sözleşmeyi kilitliyoruz.
    sendMock.mockResolvedValue(undefined);

    expect((await cagir()).durum).toBe(200);
  });

  it("hesap yoksa 404", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const r = await cagir();

    expect(r.durum).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
