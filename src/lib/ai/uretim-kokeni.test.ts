import { describe, it, expect } from "vitest";
import {
  PROMPT_SURUMU,
  YEDEK_MODEL,
  YEDEK_SURUM,
  eskiSurumMu,
  kokenDurumu,
  uretimKokeni,
  yedekKokeni,
  yedekKokenliMi,
} from "./uretim-kokeni";
import { VARSAYILAN_MODEL } from "./model-adi";

/**
 * AI çıktısının üretim kökeni (#494).
 *
 * ⚠️ ÖLÇÜLMÜŞ SORUN: `ProfileAnalysis` ve `MentorAnalysis` kalıcı
 * saklanıyor ama hangi prompt'la üretildikleri hiçbir yerde yazmıyordu.
 * Daha ağırı: AI hata verdiğinde `catch` bloğu YEDEK (mock) bir analiz
 * döndürüyor ve o da aynı tabloya yazılıyordu — yani veritabanındaki
 * analizlerin hangisinin gerçek AI olduğu AYIRT EDİLEMİYORDU. #377 bunun
 * kullanıcı yüzeyindeki hâlini belgelemişti; burada kalıcı hâli.
 */
describe("uretimKokeni", () => {
  it("yürürlükteki sürümü ve verilen modeli taşır", () => {
    expect(uretimKokeni("gemini-x")).toEqual({
      uretimSurumu: PROMPT_SURUMU,
      uretimModeli: "gemini-x",
    });
  });

  it("⚠️ MODEL ADI da tutuluyor — sürüm aynıyken model değişebilir", () => {
    // Yalnız prompt sürümünü tutmak, model değişiminin (2.5 → 3.0) çıktıya
    // etkisini görünmez kılardı.
    const a = uretimKokeni("gemini-2.5-flash");
    const b = uretimKokeni("gemini-3.0");

    expect(a.uretimSurumu).toBe(b.uretimSurumu);
    expect(a.uretimModeli).not.toBe(b.uretimModeli);
  });

  it("model adı TEK KAYNAKTAN geliyor", () => {
    // Ayrı bir dosyada duruyor çünkü `gemini-client` testlerde mock'lanıyor
    // ve sabiti oradan okumak import'u patlatıp akışı SESSİZCE yedeğe
    // düşürüyordu — testler yakaladı.
    expect(VARSAYILAN_MODEL).toBeTruthy();
    expect(uretimKokeni(VARSAYILAN_MODEL).uretimModeli).toBe(VARSAYILAN_MODEL);
  });
});

describe("eskiSurumMu", () => {
  it("yürürlükteki sürüm ESKİ değil", () => {
    expect(eskiSurumMu(PROMPT_SURUMU)).toBe(false);
  });

  it("farklı sürüm ESKİ", () => {
    expect(eskiSurumMu("2020-01-v1")).toBe(true);
  });

  it("⚠️ `null` ESKİ SAYILMAZ — 'bilinmiyor' ile 'eski' aynı şey değil", () => {
    /*
     * Köken alanları eklenmeden önce üretilmiş kayıtlar NULL taşıyor.
     * Onları "eski" diye işaretlemek, gerçekte güncel olabilecek analizleri
     * yeniden ürettirirdi — ve her yeniden üretim ÜCRETLİ bir AI çağrısı.
     * Bilinmeyeni uydurmamak, #328/#331'in kararı.
     */
    expect(eskiSurumMu(null)).toBe(false);
    expect(eskiSurumMu(undefined)).toBe(false);
    expect(eskiSurumMu("")).toBe(false);
  });
});

describe("sürüm biçimi", () => {
  it("sıralanabilir tarih biçimi — ne zaman değiştiği okunsun", () => {
    // `RIZA_METIN_SURUMU` (#327) ile aynı desen.
    expect(PROMPT_SURUMU).toMatch(/^\d{4}-\d{2}-v\d+$/);
  });
});

describe("yedek köken (#501)", () => {
  /*
   * ⚠️ NEDEN AYRI BİR İŞARET: #494 yedek çıktıyı `null` köken ile
   * kaydediyordu. Ama `null` aynı zamanda köken sütunları eklenmeden önce
   * üretilmiş kayıtların değeri — yani tek bir değer "bu içerik uydurma"
   * ile "bunun ne olduğunu bilmiyoruz"u birden anlatıyordu. Arayüzde bu
   * ikisine aynı cümle kurulamaz, karar girdisi olarak yalnız ilki elenir.
   */
  it("⚠️ yedek işareti `null` DEĞİL — 'bilinmiyor' ile karışmamalı", () => {
    expect(yedekKokeni().uretimSurumu).toBe(YEDEK_SURUM);
    expect(yedekKokeni().uretimSurumu).not.toBeNull();
    expect(yedekKokeni().uretimModeli).toBe(YEDEK_MODEL);
  });

  it("⚠️ yedek, prompt sürümü TAŞIMAZ — hiç kurulmamış çağrı olmuş gibi görünmesin", () => {
    expect(yedekKokeni().uretimSurumu).not.toBe(PROMPT_SURUMU);
  });

  it("yedekKokenliMi yalnız yedek işaretine `true` der", () => {
    expect(yedekKokenliMi(YEDEK_SURUM)).toBe(true);
    expect(yedekKokenliMi(PROMPT_SURUMU)).toBe(false);
    expect(yedekKokenliMi("2020-01-v1")).toBe(false);
    expect(yedekKokenliMi(null)).toBe(false);
    expect(yedekKokenliMi(undefined)).toBe(false);
  });

  /*
   * ⚠️ "Eski sürüm" demek, YENİDEN ÜRETMENİN İŞE YARAYACAĞINI ima eder.
   * Yedeğin sebebi ise genellikle AI'ın hiç çalışmamasıdır; aynı cümleyi
   * kurmak kullanıcıyı yanlış eyleme iter.
   */
  it("⚠️ yedek ESKİ SAYILMAZ — farklı sorun, farklı çözüm", () => {
    expect(eskiSurumMu(YEDEK_SURUM)).toBe(false);
  });
});

describe("kokenDurumu", () => {
  it("dört durumu ayırır", () => {
    expect(kokenDurumu(PROMPT_SURUMU)).toBe("guncel");
    expect(kokenDurumu(YEDEK_SURUM)).toBe("yedek");
    expect(kokenDurumu("2020-01-v1")).toBe("eski");
    expect(kokenDurumu(null)).toBe("bilinmiyor");
    expect(kokenDurumu(undefined)).toBe("bilinmiyor");
  });

  it("⚠️ yedek ile bilinmiyor AYRI durumlar", () => {
    expect(kokenDurumu(YEDEK_SURUM)).not.toBe(kokenDurumu(null));
  });
});
