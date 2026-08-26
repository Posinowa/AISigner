// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * #218 — yeniden deneme sözleşmesi.
 *
 * En kritik iki davranış:
 * - KALICI hatalar yeniden denenmemeli (yalnızca gecikme üretir)
 * - `Retry-After` başlığına saygı duyulmalı; GitHub ne zaman döneceğimizi
 *   söylüyorsa kendi tahminimizi dayatmamalıyız
 */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  yenidenDene,
  denenebilirMi,
  beklemeSuresiMs,
  MAKS_BEKLEME_MS,
} from "./retry";

/** Octokit hatası biçimi. */
const hata = (status: number, headers: Record<string, string> = {}) =>
  Object.assign(new Error("gh"), { status, response: { headers } });

describe("denenebilirMi — geçici hatalar", () => {
  it("429 denenir", () => {
    expect(denenebilirMi(hata(429))).toBe(true);
  });

  it.each([500, 502, 503, 504])("%s denenir", (s) => {
    expect(denenebilirMi(hata(s))).toBe(true);
  });

  it("ikincil oran sınırı (403 + retry-after) denenir", () => {
    expect(denenebilirMi(hata(403, { "retry-after": "5" }))).toBe(true);
  });

  it("kotası tükenmiş 403 denenir", () => {
    expect(denenebilirMi(hata(403, { "x-ratelimit-remaining": "0" }))).toBe(true);
  });
});

describe("denenebilirMi — kalıcı hatalar", () => {
  it.each([
    ["401 yetkisiz", 401],
    ["404 bulunamadı", 404],
    ["422 zaten var", 422],
    ["400 geçersiz istek", 400],
  ])("%s DENENMEZ", (_ad, s) => {
    // Tekrarlamak aynı sonucu verir; yalnızca gecikme üretir.
    expect(denenebilirMi(hata(s))).toBe(false);
  });

  it("düz yetki hatası (403, başlık yok) denenmez", () => {
    expect(denenebilirMi(hata(403))).toBe(false);
  });

  it("status taşımayan hata denenmez", () => {
    expect(denenebilirMi(new Error("kopuk baglanti"))).toBe(false);
    expect(denenebilirMi(null)).toBe(false);
  });
});

describe("beklemeSuresiMs", () => {
  it("Retry-After başlığına saygı duyulur", () => {
    expect(beklemeSuresiMs(hata(429, { "retry-after": "7" }), 1)).toBe(7000);
  });

  it("Retry-After yoksa üstel geri çekilme", () => {
    expect(beklemeSuresiMs(hata(500), 1)).toBe(1000);
    expect(beklemeSuresiMs(hata(500), 2)).toBe(2000);
    expect(beklemeSuresiMs(hata(500), 3)).toBe(4000);
  });

  it("çok büyük Retry-After üst sınıra kırpılır", () => {
    // Süresiz askıda kalmayalım.
    expect(beklemeSuresiMs(hata(429, { "retry-after": "99999" }), 1)).toBe(
      MAKS_BEKLEME_MS,
    );
  });

  it("sayı olmayan Retry-After yok sayılır", () => {
    expect(beklemeSuresiMs(hata(429, { "retry-after": "yarin" }), 1)).toBe(1000);
  });

  it("üstel geri çekilme de üst sınırı aşmaz", () => {
    expect(beklemeSuresiMs(hata(500), 20)).toBe(MAKS_BEKLEME_MS);
  });
});

describe("yenidenDene", () => {
  const bekle = vi.fn(async () => {});

  // Casus testler arasinda paylasildigi icin her testte sifirlanmali.
  beforeEach(() => bekle.mockClear());

  it("başarılı çağrı tek seferde döner", async () => {
    const islem = vi.fn(async () => "tamam");

    expect(await yenidenDene(islem, { ad: "t", bekle })).toBe("tamam");
    expect(islem).toHaveBeenCalledTimes(1);
    expect(bekle).not.toHaveBeenCalled();
  });

  it("geçici hatadan sonra başarı", async () => {
    const islem = vi
      .fn()
      .mockRejectedValueOnce(hata(429, { "retry-after": "1" }))
      .mockResolvedValue("tamam");

    expect(await yenidenDene(islem, { ad: "t", bekle })).toBe("tamam");
    expect(islem).toHaveBeenCalledTimes(2);
  });

  it("kalıcı hatada TEK deneme yapılır", async () => {
    const islem = vi.fn().mockRejectedValue(hata(404));

    await expect(yenidenDene(islem, { ad: "t", bekle })).rejects.toThrow();

    expect(islem, "kalıcı hata tekrarlanmamalı").toHaveBeenCalledTimes(1);
    expect(bekle).not.toHaveBeenCalled();
  });

  it("deneme hakkı bitince hata OLDUĞU GİBİ fırlatılır", async () => {
    // Çağıran taraf hataNedeni ile yorumlamayı sürdürebilmeli.
    const orjinal = hata(503);
    const islem = vi.fn().mockRejectedValue(orjinal);

    await expect(
      yenidenDene(islem, { ad: "t", maksDeneme: 3, bekle }),
    ).rejects.toBe(orjinal);
    expect(islem).toHaveBeenCalledTimes(3);
  });

  it("son denemeden sonra BEKLENMEZ", async () => {
    // Hak bittiyse beklemek boşuna gecikme.
    const islem = vi.fn().mockRejectedValue(hata(500));

    await expect(
      yenidenDene(islem, { ad: "t", maksDeneme: 2, bekle }),
    ).rejects.toThrow();

    expect(bekle).toHaveBeenCalledTimes(1);
  });

  it("Retry-After süresi kadar beklenir", async () => {
    const islem = vi
      .fn()
      .mockRejectedValueOnce(hata(429, { "retry-after": "3" }))
      .mockResolvedValue("ok");

    await yenidenDene(islem, { ad: "t", bekle });

    expect(bekle).toHaveBeenCalledWith(3000);
  });
});
