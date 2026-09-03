// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * `uygulamaUrl` (#392).
 *
 * ⚠️ Bu fonksiyon var çünkü `NEXT_PUBLIC_APP_URL` YEDİ ayrı yerde okunuyor ve
 * ÜÇ FARKLI varsayılana düşüyordu. Sonucu: sertifikanın QR bağlantısı bir alan
 * adına, LinkedIn paylaşımı BAŞKA bir alan adına gidiyordu.
 */

import { uygulamaUrl } from "./app-url";

afterEach(() => vi.unstubAllEnvs());

describe("değişken tanımlıyken", () => {
  it("olduğu gibi kullanılır", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staj.posinowa.com");
    expect(uygulamaUrl()).toBe("https://staj.posinowa.com");
  });

  it("sondaki eğik çizgiler temizlenir — `${url}/yol` çift çizgi üretmesin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staj.posinowa.com///");
    expect(uygulamaUrl()).toBe("https://staj.posinowa.com");
  });

  it("baştaki/sondaki boşluk kırpılır", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "  https://a.com  ");
    expect(uygulamaUrl()).toBe("https://a.com");
  });
});

describe("değişken YOKKEN", () => {
  it("⚠️ ÜRETİMDE HATA FIRLATIR — sessiz varsayım bu hatayı üretmişti", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => uygulamaUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("üretimde SADECE BOŞLUK da geçersiz sayılır", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "   ");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => uygulamaUrl()).toThrow();
  });

  it("geliştirmede localhost'a düşer — orada yanlış alan adı riski yok", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(uygulamaUrl()).toBe("http://localhost:3000");
  });

  it("hata mesajı NEDENİNİ söyler — sertifika/e-posta bağlantıları", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => uygulamaUrl()).toThrow(/[Ss]ertifika/);
  });
});

/**
 * Asıl kilitlenen davranış: ÇAĞIRAN YERLER AYNI ADRESİ görmeli.
 *
 * Hata tam olarak buydu — `certificate.ts` `posinowa.com`, `paylasim.ts`
 * `aisigner.com` üretiyordu; QR ve LinkedIn bağlantısı farklı alan adlarına
 * gidiyordu.
 */
describe("tek kaynak", () => {
  it("aynı ortamda her çağrı AYNI adresi döner", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://tek.example.com");

    const adresler = new Set([uygulamaUrl(), uygulamaUrl(), uygulamaUrl()]);
    expect(adresler.size).toBe(1);
  });
});
