import { describe, it, expect, afterEach } from "vitest";
import {
  GOSTERIM_ZAMAN_DILIMI,
  tarihBicimle,
  tarihUzunBicimle,
  saatBicimle,
  tarihSaatBicimle,
} from "./tarih";

/**
 * #460 — Saat dilimi TEK KAYNAKTAN, açıkça veriliyor.
 *
 * ⚠️ TESTLER SÜRECİN SAAT DİLİMİNİ DEĞİŞTİRİR, bu şart. Hata tam olarak
 * "çalıştığı ortamın dilimini kullanmak"tı; geliştirme makinesi zaten UTC+3
 * olduğu için doğru sonucu görür ve hatalı bir uygulama testten GEÇERDİ.
 * #398'de ofis saati dilimlemesi için aynı önlem alınmıştı.
 */
const asilTZ = process.env.TZ;
function tzAyarla(tz: string) {
  process.env.TZ = tz;
}
afterEach(() => {
  process.env.TZ = asilTZ;
});

/** TR saatiyle 10 Eylül 14:00 → UTC'de 11:00. */
const GORUSME = new Date("2026-09-10T11:00:00.000Z");
/** TR saatiyle 5 Eylül 00:30 → UTC'de 4 Eylül 21:30. */
const GECE_YARISI = new Date("2026-09-04T21:30:00.000Z");

describe("#460 — çıktı ÇALIŞTIĞI ORTAMDAN bağımsız", () => {
  it("⚠️ UTC sunucuda da TR saatini basar — asıl hata buydu", () => {
    tzAyarla("UTC");
    expect(saatBicimle(GORUSME)).toBe("14:00");
  });

  it("UTC+3 makinede aynı sonucu verir", () => {
    tzAyarla("Europe/Istanbul");
    expect(saatBicimle(GORUSME)).toBe("14:00");
  });

  it("⚠️ uzak bir dilimde bile aynı — sunucu ile istemci AYNI şeyi basmalı", () => {
    tzAyarla("America/New_York");
    expect(saatBicimle(GORUSME)).toBe("14:00");
    tzAyarla("Asia/Tokyo");
    expect(saatBicimle(GORUSME)).toBe("14:00");
  });

  it("⚠️ gece yarısına yakın tarih GÜN KAYDIRMAZ", () => {
    // UTC'de 4 Eylül 21:30 ama TR'de 5 Eylül 00:30.
    tzAyarla("UTC");
    expect(tarihBicimle(GECE_YARISI)).toBe("05.09.2026");
  });
});

describe("#460 — timeZone çağıran tarafından EZİLEMEZ", () => {
  it("⚠️ seçeneklerle başka bir dilim verilse bile yok sayılır", () => {
    tzAyarla("UTC");
    // Bir çağıran yanlışlıkla (ya da bilerek) UTC geçirirse sözleşme bozulurdu.
    const s = saatBicimle(GORUSME, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    } as Intl.DateTimeFormatOptions);
    expect(s).toBe("14:00");
  });

  it("gösterim dilimi Europe/Istanbul", () => {
    expect(GOSTERIM_ZAMAN_DILIMI).toBe("Europe/Istanbul");
  });

  it("⚠️ Türkiye yaz saati uygulamıyor — dilim yıl boyu sabit +03:00", () => {
    tzAyarla("UTC");
    // Dördü de UTC 12:00; hepsi 15:00 basmalı. Yaz saati olsaydı biri kayardı.
    for (const ay of ["01", "04", "07", "10"]) {
      expect(saatBicimle(new Date(`2026-${ay}-15T12:00:00.000Z`))).toBe("15:00");
    }
  });
});

describe("#460 — biçimler", () => {
  it("tarihBicimle kısa tarih verir", () => {
    expect(tarihBicimle(GORUSME)).toBe("10.09.2026");
  });

  it("tarihUzunBicimle ay adıyla verir", () => {
    expect(tarihUzunBicimle(GORUSME)).toBe("10 Eylül 2026");
  });

  it("tarihSaatBicimle ikisini birden verir", () => {
    expect(tarihSaatBicimle(GORUSME)).toContain("10.09.2026");
    expect(tarihSaatBicimle(GORUSME)).toContain("14:00");
  });

  it("özel seçenekler geçirilebilir", () => {
    expect(tarihBicimle(GORUSME, { weekday: "long" })).toBe("Perşembe");
  });

  it("ISO metin de kabul eder — API yanıtları string döner", () => {
    expect(tarihBicimle("2026-09-10T11:00:00.000Z")).toBe("10.09.2026");
  });
});

describe("#460 — geçersiz girdi", () => {
  it("⚠️ null/undefined 'Invalid Date' BASMAZ", () => {
    expect(tarihBicimle(null)).toBe("—");
    expect(tarihBicimle(undefined)).toBe("—");
  });

  it("⚠️ ayrıştırılamayan metin de boş değere düşer", () => {
    expect(tarihBicimle("bu bir tarih değil")).toBe("—");
    expect(saatBicimle("")).toBe("—");
  });

  it("boş değer çağıran tarafından seçilebilir", () => {
    expect(tarihBicimle(null, undefined, "belirtilmedi")).toBe("belirtilmedi");
  });

  it("epoch sayısı kabul edilir", () => {
    expect(tarihBicimle(GORUSME.getTime())).toBe("10.09.2026");
  });
});
