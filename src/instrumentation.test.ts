// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Sayaç yayınının KABLOLAMASI (#486).
 *
 * ⚠️ Modülün kendisi (`metrics-raporu`) ayrıca test ediliyor; burada
 * ölçülen şey ONUN ÇAĞRILIP ÇAĞRILMADIĞI. Sessizce kurulmayan bir teşhis
 * yayıcısı, düzeltmeye çalıştığımız durumun aynısını üretirdi: sinyal
 * toplanıyor ama kimse görmüyor.
 *
 * Canlı olarak da doğrulandı — dev sunucusu açılışta
 * "Sayaç yayını başladı { pid, aralikMs: 300000 }" yazıyor, yani Next'in
 * `register` kancası gerçekten çağrılıyor. Bu test periyodik dalı kilitliyor.
 */
const { loggerMock, ozetMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  ozetMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/metrics-raporu", () => ({ sayacOzeti: ozetMock }));

import { register } from "./instrumentation";

/**
 * ⚠️ `register` içindeki dinamik `import()`'lar GERÇEK olay döngüsü turu
 * istiyor. Sahte zamanlayıcı aktifken `setTimeout(c, 0)` ile beklemek asla
 * çözülmüyordu (ilk sürüm burada 5 sn timeout ile patladı). Bu yüzden
 * zamanlayıcılar `shouldAdvanceTime` ile kuruluyor ve koşul yoklanıyor.
 */
async function kosulBekle(kosul: () => boolean, azamiMs = 2000): Promise<void> {
  const bitis = Date.now() + azamiMs;
  while (!kosul() && Date.now() < bitis) {
    await new Promise((c) => globalThis.setTimeout(c, 10));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  ozetMock.mockReturnValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("register — sayaç yayını", () => {
  it("⚠️ EDGE çalışma zamanında HİÇ kurulmaz", () => {
    // Bu dosya edge için de paketleniyor ve logger zinciri Node çekirdek
    // modüllerine iniyor; koruma kalkarsa build komple patlıyor.
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const spy = vi.spyOn(globalThis, "setInterval");

    register();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("açılışta yayının kurulduğunu loglar — tek canlı kanıt bu", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    register();
    await kosulBekle(() => loggerMock.info.mock.calls.length > 0);

    expect(loggerMock.info).toHaveBeenCalledWith(
      "Sayaç yayını başladı",
      expect.objectContaining({ aralikMs: expect.any(Number) }),
    );
  });

  it("⚠️ zamanlayıcı UNREF — tek başına süreci ayakta tutmamalı", () => {
    const unref = vi.fn();
    const spy = vi
      .spyOn(globalThis, "setInterval")
      .mockReturnValue({ unref } as unknown as NodeJS.Timeout);

    register();

    expect(unref).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("aralık dolunca DEĞİŞEN sayaçlar loglanır", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ozetMock.mockReturnValue([{ ad: "ai_chat.fallback", toplam: 3, artis: 3 }]);

    register();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 10);
    await kosulBekle(() =>
      loggerMock.info.mock.calls.some((c) => c[0] === "Sayaç özeti"),
    );

    expect(loggerMock.info).toHaveBeenCalledWith(
      "Sayaç özeti",
      expect.objectContaining({
        pid: expect.any(Number),
        sayaclar: [{ ad: "ai_chat.fallback", toplam: 3, artis: 3 }],
      }),
    );
  });

  it("⚠️ DEĞİŞEN YOKSA hiç log yazılmaz — sessiz sistem sessiz log", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ozetMock.mockReturnValue([]);

    register();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 10);
    // Özet çağrıldığını bekle; log YAZILMADIĞINI ondan sonra iddia et.
    await kosulBekle(() => ozetMock.mock.calls.length > 0);

    const ozetSatirlari = loggerMock.info.mock.calls.filter(
      (c) => c[0] === "Sayaç özeti",
    );
    expect(ozetSatirlari).toHaveLength(0);
  });

  it("⚠️ özet FIRLATIRSA uygulama etkilenmez", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ozetMock.mockImplementation(() => {
      throw new Error("beklenmedik");
    });

    register();

    await expect(
      vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 10),
    ).resolves.not.toThrow();
  });
});
