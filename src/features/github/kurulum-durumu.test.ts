import { describe, it, expect } from "vitest";
import {
  KURULUM_TAKILMA_DK,
  kurulumTakildiMi,
  takilmaEsigi,
} from "./kurulum-durumu";

/**
 * Takılı kalmış GitHub kurulumu (#483).
 *
 * ⚠️ ÖLÇÜLMÜŞ SORUN: kurulum `after()` ile arka planda koşuyor. Süreç
 * yeniden başlarsa iş yarıda kalıyor ve atama `PROVISIONING`'de asılı
 * kalıyor — durumu `ERROR`'a çekecek kod da o süreçle ölüyor.
 *
 * `provisioning.ts` kurtarmanın "admin panelinden Tekrar Dene" olduğunu
 * yazıyordu; O YOL YOKTU: düğme yalnız `ERROR`'da render ediliyordu, kilit
 * de `notIn: ["PROVISIONING", ...]` ile isteği reddediyordu. Üstelik arayüz
 * `PROVISIONING` gördükçe yokladığı için sayfa sonsuza dek istek atıyordu.
 */
const SIMDI = new Date("2026-09-04T12:00:00.000Z");

/** `dk` dakika önce. */
function once(dk: number): Date {
  return new Date(SIMDI.getTime() - dk * 60_000);
}

describe("kurulumTakildiMi", () => {
  it("⚠️ YALNIZ PROVISIONING takılabilir — diğer durumlar zaten sonlanmış", () => {
    for (const durum of ["PROVISIONED", "ERROR", "NOT_PROVISIONED", "LINKED"]) {
      expect(kurulumTakildiMi(durum, once(999), SIMDI), durum).toBe(false);
    }
  });

  it("eşiği aşan PROVISIONING takılmış sayılır", () => {
    expect(kurulumTakildiMi("PROVISIONING", once(KURULUM_TAKILMA_DK + 1), SIMDI)).toBe(
      true,
    );
  });

  it("⚠️ EŞİĞİN ALTINDAKİ kurulum takılmış SAYILMAZ — canlı iş ezilmesin", () => {
    /*
     * `isiYurut` ARA GÜNCELLEME YAPMIYOR: başta PROVISIONING, sonda
     * PROVISIONED/ERROR yazıyor. Yani canlı bir iş `updatedAt`'i
     * tazelemiyor ve kısa bir eşik ÇALIŞAN kurulumun üstüne ikincisini
     * başlatırdı — aynı repoya paralel yazma.
     */
    expect(kurulumTakildiMi("PROVISIONING", once(KURULUM_TAKILMA_DK - 1), SIMDI)).toBe(
      false,
    );
    expect(kurulumTakildiMi("PROVISIONING", SIMDI, SIMDI)).toBe(false);
  });

  it("tam eşikte henüz takılmış değil — sınır dışlayıcı", () => {
    expect(kurulumTakildiMi("PROVISIONING", once(KURULUM_TAKILMA_DK), SIMDI)).toBe(
      false,
    );
  });

  it("⚠️ TARİH YOKSA ya da GEÇERSİZSE takılmış sayılmaz", () => {
    // Kanıt yokken kurtarmaya izin vermek, koşan bir işin üstüne ikinci
    // kurulum başlatabilirdi.
    expect(kurulumTakildiMi("PROVISIONING", null, SIMDI)).toBe(false);
    expect(kurulumTakildiMi("PROVISIONING", undefined, SIMDI)).toBe(false);
    expect(kurulumTakildiMi("PROVISIONING", "gecersiz-tarih", SIMDI)).toBe(false);
  });

  it("ISO metin tarih de kabul edilir — API'den string dönüyor", () => {
    expect(
      kurulumTakildiMi("PROVISIONING", once(KURULUM_TAKILMA_DK + 5).toISOString(), SIMDI),
    ).toBe(true);
  });
});

describe("takilmaEsigi", () => {
  it("eşik GEÇMİŞTE — az önce başlayan kurulum geri alınamaz", () => {
    const esik = takilmaEsigi(SIMDI);

    expect(esik.getTime()).toBeLessThan(SIMDI.getTime());
    expect(SIMDI.getTime() - esik.getTime()).toBe(KURULUM_TAKILMA_DK * 60_000);
  });

  it("eşik ile yüklem AYNI sınırı kullanır — ayrışırlarsa biri yalan söyler", () => {
    // Kilit `updatedAt < esik` ile geri alıyor, arayüz `kurulumTakildiMi`
    // ile gösteriyor. İkisi ayrışsaydı "Tekrar Dene" görünüp reddedilirdi.
    const esik = takilmaEsigi(SIMDI);
    const hemenOncesi = new Date(esik.getTime() - 1);
    const hemenSonrasi = new Date(esik.getTime() + 1);

    expect(kurulumTakildiMi("PROVISIONING", hemenOncesi, SIMDI)).toBe(true);
    expect(kurulumTakildiMi("PROVISIONING", hemenSonrasi, SIMDI)).toBe(false);
  });
});
