// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Sentry entegrasyonu (#519).
 *
 * Kilitlenen üç garanti:
 *   1. DSN yoksa özellik KAPALI — yapılandırılmamış olmak hata değil.
 *   2. Aydınlatma metninde YAZILI değilse, DSN olsa bile AÇILMAZ.
 *   3. Gönderilen olayda gövde/başlık/çerez/sorgu/kullanıcı YOK.
 */

const { initMock, captureMock, kvkkMock, loggerMock } = vi.hoisted(() => ({
  initMock: vi.fn(),
  captureMock: vi.fn(),
  kvkkMock: { HATA_TESHIS: { ad: "Sentry", bolge: "AB", gizlilikUrl: "https://x.test" } as unknown },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ init: initMock, captureException: captureMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/features/legal/kvkk", () => kvkkMock);

import {
  sentryKur,
  sentryBildir,
  sentryKurulabilirMi,
  sentryDurumunuSifirlaForTests,
} from "./sentry";

beforeEach(() => {
  vi.clearAllMocks();
  sentryDurumunuSifirlaForTests();
  delete process.env.SENTRY_DSN;
  kvkkMock.HATA_TESHIS = { ad: "Sentry", bolge: "AB", gizlilikUrl: "https://x.test" };
});

describe("kurulum kapıları", () => {
  it("DSN yoksa kurulmaz ve SESSİZ geçer — yapılandırılmamış olmak hata değil", async () => {
    await sentryKur();

    expect(initMock).not.toHaveBeenCalled();
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });

  /*
   * ⚠️ EN KRİTİK İDDİA. Hata teşhis hizmeti yurt dışına aktarımdır ve
   * aydınlatma metninde yazılı olmadan yapılamaz. İki ayar ayrı ayrı
   * yönetilseydi, biri açılıp diğeri unutulduğunda platform sessizce
   * BEYAN EDİLMEMİŞ bir aktarım yapardı.
   */
  it("⚠️ metinde yazılı değilse DSN olsa BİLE açılmaz — ve sebebini loglar", async () => {
    process.env.SENTRY_DSN = "https://ornek@sentry.test/1";
    kvkkMock.HATA_TESHIS = null;

    await sentryKur();

    expect(initMock).not.toHaveBeenCalled();
    expect(loggerMock.warn).toHaveBeenCalled();
    expect(sentryKurulabilirMi()).toBe(false);
  });

  it("DSN + metin varsa kurulur", async () => {
    process.env.SENTRY_DSN = "https://ornek@sentry.test/1";

    await sentryKur();

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(sentryKurulabilirMi()).toBe(true);
  });

  it("iki kez çağrılsa da bir kez kurulur", async () => {
    process.env.SENTRY_DSN = "https://ornek@sentry.test/1";

    await sentryKur();
    await sentryKur();

    expect(initMock).toHaveBeenCalledTimes(1);
  });
});

describe("gizlilik ayarları", () => {
  beforeEach(async () => {
    process.env.SENTRY_DSN = "https://ornek@sentry.test/1";
    await sentryKur();
  });

  it("⚠️ varsayılan PII kapalı ve izleme örneklemesi sıfır", () => {
    const ayar = initMock.mock.calls[0][0];

    expect(ayar.sendDefaultPii).toBe(false);
    expect(ayar.tracesSampleRate).toBe(0);
  });

  /*
   * ⚠️ `sendDefaultPii: false`'a GÜVENMİYORUZ: o bayrak yalnız SDK'nın
   * kendi eklediklerini kapatıyor, bizim ya da bir bağımlılığın olaya
   * iliştirdiği gövde/başlık için bir şey söylemiyor.
   */
  it("⚠️ beforeSend gövde, çerez, başlık, sorgu ve kullanıcıyı AYIKLAR", () => {
    const { beforeSend } = initMock.mock.calls[0][0];

    const olay = beforeSend({
      user: { id: "u1", email: "kisi@ornek.test" },
      request: {
        url: "https://app.test/api/admin/users?email=kisi@ornek.test",
        data: { password: "gizli" },
        cookies: { "next-auth.session-token": "abc" },
        headers: { authorization: "Bearer abc" },
        query_string: "email=kisi@ornek.test",
        method: "POST",
      },
    });

    expect(olay.user).toBeUndefined();
    expect(olay.request.data).toBeUndefined();
    expect(olay.request.cookies).toBeUndefined();
    expect(olay.request.headers).toBeUndefined();
    expect(olay.request.query_string).toBeUndefined();
    // Teşhis için gereken kalır.
    expect(olay.request.method).toBe("POST");
  });

  it("⚠️ sorgu dizesi URL'den de düşer — PII orada taşınabiliyor", () => {
    const { beforeSend } = initMock.mock.calls[0][0];

    const olay = beforeSend({
      request: { url: "https://app.test/verify-certificate/ABC?ad=Ay%C5%9Fe" },
    });

    expect(olay.request.url).toBe("https://app.test/verify-certificate/ABC");
  });

  it("request taşımayan olayda çökmez", () => {
    const { beforeSend } = initMock.mock.calls[0][0];

    expect(() => beforeSend({})).not.toThrow();
  });
});

describe("bildirim", () => {
  it("kurulu değilse sessizce geçer — çağıran taraf kontrol etmek zorunda kalmasın", () => {
    sentryBildir(new Error("x"));

    expect(captureMock).not.toHaveBeenCalled();
  });

  it("kuruluysa etiketlerle iletir", async () => {
    process.env.SENTRY_DSN = "https://ornek@sentry.test/1";
    await sentryKur();

    sentryBildir(new Error("patladı"), { routePath: "/api/x" });

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0][1]).toEqual({ tags: { routePath: "/api/x" } });
  });

  /*
   * ⚠️ Bu fonksiyon HATA YOLUNDAN çağrılıyor. Kendisi patlarsa asıl hatayı
   * gölgeler — #380'in "bildirim hiçbir durumda fırlatmaz" kararının aynısı.
   */
  it("⚠️ SDK patlasa bile FIRLATMAZ", async () => {
    process.env.SENTRY_DSN = "https://ornek@sentry.test/1";
    await sentryKur();
    captureMock.mockImplementation(() => {
      throw new Error("SDK çöktü");
    });

    expect(() => sentryBildir(new Error("x"))).not.toThrow();
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});
