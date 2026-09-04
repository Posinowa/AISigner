// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AI çağrılarında yeniden deneme (#471).
 *
 * ⚠️ NEDEN VAR: geçici bir hata (503, 429, kopan bağlantı) doğrudan
 * çağıranın `catch` bloğuna düşüyordu ve oradaki davranış MOCK'A DÜŞMEK.
 * Bulut tarafındaki saniyelik bir dalgalanma kullanıcıya jenerik içerik
 * olarak dönüyordu — üstelik #377'nin belgelediği gibi kullanıcı bunu
 * gerçek AI çıktısından AYIRT EDEMİYOR.
 *
 * En kritik iddia: BİLİNMEYEN HATA YENİDEN DENENMEZ. Varsayılan "denemeye
 * devam et" olsaydı kalıcı yapılandırma hataları her istekte üç kat
 * gecikme üretir ve her tekrar ücretli bir çağrı olurdu.
 */
const { sayacMock, loggerMock } = vi.hoisted(() => ({
  sayacMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/metrics", () => ({ incrementCounter: sayacMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import { gecicidMi, yenidenDene } from "./yeniden-dene";

/** Gerçek beklemeyi atla — testler saniyelerce sürmesin. */
const beklemeler: number[] = [];
const bekle = async (ms: number) => {
  beklemeler.push(ms);
};

function hata(over: Record<string, unknown> = {}, mesaj = "hata"): Error {
  return Object.assign(new Error(mesaj), over);
}

beforeEach(() => {
  vi.clearAllMocks();
  beklemeler.length = 0;
});

describe("gecicidMi — sınıflandırma", () => {
  it("⚠️ 429 GEÇİCİ — hız sınırı üstel beklemenin var olma sebebi", () => {
    expect(gecicidMi(hata({ status: 429 }))).toBe(true);
  });

  it("5xx ailesi geçici", () => {
    for (const k of [500, 502, 503, 504]) {
      expect(gecicidMi(hata({ status: k })), String(k)).toBe(true);
    }
  });

  it("⚠️ 400/401/403 GEÇİCİ DEĞİL — tekrarlanınca da aynı yanıtı verir", () => {
    for (const k of [400, 401, 403, 404]) {
      expect(gecicidMi(hata({ status: k })), String(k)).toBe(false);
    }
  });

  it("ağ hataları geçici", () => {
    expect(gecicidMi(hata({}, "read ECONNRESET"))).toBe(true);
    expect(gecicidMi(hata({}, "socket hang up"))).toBe(true);
    expect(gecicidMi(hata({}, "Model is overloaded, try again"))).toBe(true);
  });

  it("⚠️ TANINMAYAN hata geçici SAYILMAZ — varsayılan denememek", () => {
    // Varsayılan "dene" olsaydı, kalıcı yapılandırma hataları her istekte
    // üç kat gecikme üretir ve her tekrar ücretli bir çağrı olurdu.
    expect(gecicidMi(hata({}, "GOOGLE_CLOUD_PROJECT tanımlı değil"))).toBe(false);
    expect(gecicidMi(hata({}, "content blocked by safety settings"))).toBe(false);
    expect(gecicidMi("düz metin")).toBe(false);
    expect(gecicidMi(null)).toBe(false);
  });

  it("durum kodu string olarak gelse de okunur", () => {
    expect(gecicidMi(hata({ code: "503" }))).toBe(true);
    expect(gecicidMi(hata({ statusCode: 400 }))).toBe(false);
  });
});

describe("yenidenDene — davranış", () => {
  it("başarılı çağrıda tek deneme, bekleme yok", async () => {
    const islem = vi.fn().mockResolvedValue("ok");

    await expect(yenidenDene(islem, { kapsam: "t", bekle })).resolves.toBe("ok");

    expect(islem).toHaveBeenCalledTimes(1);
    expect(beklemeler).toEqual([]);
  });

  it("geçici hatadan sonra toparlarsa SONUCU döner", async () => {
    const islem = vi
      .fn()
      .mockRejectedValueOnce(hata({ status: 503 }))
      .mockResolvedValue("ok");

    await expect(yenidenDene(islem, { kapsam: "t", bekle })).resolves.toBe("ok");
    expect(islem).toHaveBeenCalledTimes(2);
  });

  it("⚠️ KALICI hatada TEK deneme — boşuna ücretli çağrı yapılmaz", async () => {
    const islem = vi.fn().mockRejectedValue(hata({ status: 400 }));

    await expect(yenidenDene(islem, { kapsam: "t", bekle })).rejects.toThrow();

    expect(islem).toHaveBeenCalledTimes(1);
    expect(beklemeler).toEqual([]);
  });

  it("deneme sayısı SINIRLI — sonsuz döngü yok", async () => {
    const islem = vi.fn().mockRejectedValue(hata({ status: 503 }));

    await expect(yenidenDene(islem, { kapsam: "t", bekle })).rejects.toThrow();

    expect(islem).toHaveBeenCalledTimes(3);
  });

  it("⚠️ HATA YUTULMAZ — son deneme de başarısızsa olduğu gibi fırlatılır", async () => {
    // Çağıranın mevcut davranışı (mock'a düşme ya da 500) korunmalı.
    const asil = hata({ status: 503 }, "asıl mesaj");
    const islem = vi.fn().mockRejectedValue(asil);

    await expect(yenidenDene(islem, { kapsam: "t", bekle })).rejects.toBe(asil);
  });

  it("bekleme ÜSTEL artar", async () => {
    const islem = vi.fn().mockRejectedValue(hata({ status: 503 }));

    await expect(yenidenDene(islem, { kapsam: "t", bekle })).rejects.toThrow();

    expect(beklemeler).toHaveLength(2);
    // Jitter var: ikinci bekleme ilkinin tabanının en az iki katından başlar.
    expect(beklemeler[1]).toBeGreaterThanOrEqual(1000);
  });

  it("⚠️ JİTTER var — aynı anda hata alanlar aynı anda dönmesin", async () => {
    // Jitter olmadan bütün istemciler senkron yeniden denerdi; bulut tarafı
    // zaten zorlanıyorken yükü dalgalar hâlinde geri gönderirdi.
    const gorulen = new Set<number>();
    for (let i = 0; i < 12; i++) {
      beklemeler.length = 0;
      const islem = vi.fn().mockRejectedValue(hata({ status: 503 }));
      await yenidenDene(islem, { kapsam: "t", bekle }).catch(() => {});
      gorulen.add(beklemeler[0]);
    }
    expect(gorulen.size).toBeGreaterThan(1);
  });

  it("toplam bekleme MAKUL — istek bütçesini yakmaz", async () => {
    const islem = vi.fn().mockRejectedValue(hata({ status: 503 }));
    await yenidenDene(islem, { kapsam: "t", bekle }).catch(() => {});

    const toplam = beklemeler.reduce((a, b) => a + b, 0);
    expect(toplam).toBeLessThanOrEqual(3000);
  });
});

describe("gözlemlenebilirlik", () => {
  it("yeniden deneme sayaca yazılır", async () => {
    const islem = vi
      .fn()
      .mockRejectedValueOnce(hata({ status: 503 }))
      .mockResolvedValue("ok");

    await yenidenDene(islem, { kapsam: "t", bekle });

    expect(sayacMock).toHaveBeenCalledWith("ai.yeniden-deneme");
  });

  it("⚠️ TOPARLAMA sessiz değil — kaç denemede düzeldiği loglanır", async () => {
    const islem = vi
      .fn()
      .mockRejectedValueOnce(hata({ status: 503 }))
      .mockResolvedValue("ok");

    await yenidenDene(islem, { kapsam: "generateContent", bekle });

    expect(sayacMock).toHaveBeenCalledWith("ai.yeniden-deneme.basarili");
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.stringContaining("yeniden denemede başarılı"),
      expect.objectContaining({ kapsam: "generateContent", deneme: 2 }),
    );
  });

  it("tükenen ve kalıcı hatalar AYRI sayaçlara yazılır", async () => {
    await yenidenDene(vi.fn().mockRejectedValue(hata({ status: 503 })), {
      kapsam: "t",
      bekle,
    }).catch(() => {});
    expect(sayacMock).toHaveBeenCalledWith("ai.yeniden-deneme.tukendi");

    sayacMock.mockClear();
    await yenidenDene(vi.fn().mockRejectedValue(hata({ status: 400 })), {
      kapsam: "t",
      bekle,
    }).catch(() => {});
    expect(sayacMock).toHaveBeenCalledWith("ai.hata.kalici");
  });
});
