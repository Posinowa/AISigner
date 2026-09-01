// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #329 — SSE ucu.
 *
 * Kritik olan iki şey:
 *   1. Kimliği doğrulanmamış istek akışa HİÇ abone olmamalı — akış kullanıcıya
 *      ait mesaj içeriğini taşıyor.
 *   2. Bağlantı kapandığında abonelik BIRAKILMALI; bırakılmazsa pod, kimsenin
 *      dinlemediği kullanıcılar için sonsuza dek sorgu atmayı sürdürür.
 */

const { requireAuthMock, aboneOlMock, birakMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  aboneOlMock: vi.fn(),
  birakMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/messaging/server/canli-akis", () => ({
  aboneOl: aboneOlMock,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "u1", role: "STUDENT" } },
  });
  aboneOlMock.mockReturnValue(birakMock);
});

describe("yetki", () => {
  it("oturumsuz istek akışa abone OLMAZ", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(aboneOlMock).not.toHaveBeenCalled();
  });

  it("aboneliği OTURUMDAKİ kullanıcıya bağlar", async () => {
    // Sorgu parametresinden gelen bir kimliğe güvenilseydi, herkes başkasının
    // mesajlarını dinleyebilirdi.
    await GET();

    expect(aboneOlMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
    );
  });
});

describe("SSE sözleşmesi", () => {
  it("doğru başlıklarla döner", async () => {
    const res = await GET();

    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    // Vekil tamponlaması olayları bağlantı kapanana kadar bekletirdi.
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("olayları SSE biçiminde yazar", async () => {
    const res = await GET();
    const okuyucu = res.body!.getReader();
    const coz = new TextDecoder();

    // İlk parça: bağlantı onayı (yorum satırı, istemcide olay üretmez).
    const ilk = coz.decode((await okuyucu.read()).value);
    expect(ilk.startsWith(":")).toBe(true);

    const { gonder } = aboneOlMock.mock.calls[0][0];
    gonder({ tip: "okunmamis", sayi: 3 });

    const parca = coz.decode((await okuyucu.read()).value);
    expect(parca).toContain("event: okunmamis");
    expect(parca).toContain('"sayi":3');
    // SSE çerçevesi boş satırla biter; bitmezse istemci olayı işlemez.
    expect(parca.endsWith("\n\n")).toBe(true);

    await okuyucu.cancel();
  });

  it("bağlantı iptal edilince aboneliği BIRAKIR", async () => {
    const res = await GET();
    const okuyucu = res.body!.getReader();
    await okuyucu.read();

    await okuyucu.cancel();

    expect(birakMock).toHaveBeenCalled();
  });
});
