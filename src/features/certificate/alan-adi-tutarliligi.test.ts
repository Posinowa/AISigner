// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * #392 — QR/DOĞRULAMA BAĞLANTISI İLE LİNKEDİN BAĞLANTISI FARKLI ALAN ADINA
 * GİDİYORDU.
 *
 * `certificate.ts` `https://posinowa.com`, `paylasim.ts` `https://aisigner.com`
 * varsayıyordu. Sertifika QR'ı basılıp paylaşıldıktan sonra GERİ ALINAMAZ:
 * yanlış alan adı taşıyan belgeler dolaşımda kalır.
 *
 * Bu test iki tarafın AYNI adresi ürettiğini kilitliyor.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { dogrulamaUrl, linkedInEkleUrl } from "./paylasim";
// ⚠️ Asıl çelişen ÇİFT buydu: certificate.ts posinowa.com, paylasim.ts
// aisigner.com üretiyordu.
import { getCertificateVerificationUrl } from "./server/certificate";

afterEach(() => vi.unstubAllEnvs());

/** URL'in alan adı kısmı. */
const alanAdi = (url: string) => new URL(url).origin;

describe("alan adı tutarlılığı", () => {
  it("⚠️ doğrulama bağlantısı ile LinkedIn bağlantısındaki doğrulama URL'i AYNI alan adında", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staj.posinowa.com");

    const dogrulama = dogrulamaUrl("AIS-2026-0001");
    const linkedIn = linkedInEkleUrl({
      certificateNumber: "AIS-2026-0001",
      issuedAt: "2026-01-15",
    });

    expect(alanAdi(dogrulama)).toBe("https://staj.posinowa.com");
    // LinkedIn URL'i içine gömülen sertifika adresi de aynı alan adı olmalı.
    expect(decodeURIComponent(linkedIn)).toContain("https://staj.posinowa.com");
  });

  it("alan adı değişince İKİSİ BİRDEN değişir", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://baska.example.com");

    expect(alanAdi(dogrulamaUrl("X"))).toBe("https://baska.example.com");
    expect(decodeURIComponent(linkedInEkleUrl({
      certificateNumber: "X",
      issuedAt: "2026-01-15",
    }))).toContain("https://baska.example.com");
  });

  it("sondaki eğik çizgi çift çizgi üretmez", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://a.com/");

    expect(dogrulamaUrl("X")).toBe("https://a.com/verify-certificate/X");
  });

  it("⚠️ SUNUCU ve İSTEMCİ tarafı doğrulama URL'i BİREBİR aynı", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staj.posinowa.com");

    // certificate.ts (QR/sertifika belgesi) ile paylasim.ts (LinkedIn/kopyala)
    // aynı adresi üretmeli — ayrışmaları bu issue'nun ta kendisiydi.
    expect(getCertificateVerificationUrl("AIS-2026-0001")).toBe(
      dogrulamaUrl("AIS-2026-0001"),
    );
  });
});
