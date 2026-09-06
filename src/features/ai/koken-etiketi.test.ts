import { describe, it, expect } from "vitest";
import { kokenEtiketi } from "./koken-etiketi";
import { PROMPT_SURUMU, YEDEK_SURUM, YEDEK_MODEL } from "@/lib/ai/uretim-kokeni";

/**
 * Kökenin arayüzde nasıl anlatıldığı (#501).
 *
 * ⚠️ ÖLÇÜLMÜŞ SORUN: #494 kökeni veritabanına yazdı, hiçbir yüzey okumadı.
 * Yedekten üretilmiş bir analiz mentöre/admin'e gerçek AI değerlendirmesi
 * gibi görünmeye DEVAM ediyordu — #405'in "sorun durumun görünmemesi değil,
 * SONUCUNUN söylenmemesiydi" dersinin aynısı.
 */
describe("kokenEtiketi", () => {
  it("güncel köken: model ve sürüm okunur, ton nötr", () => {
    const e = kokenEtiketi(PROMPT_SURUMU, "gemini-2.5-flash");

    expect(e.durum).toBe("guncel");
    expect(e.ton).toBe("notr");
    expect(e.aciklama).toContain("gemini-2.5-flash");
    expect(e.aciklama).toContain(PROMPT_SURUMU);
  });

  /*
   * ⚠️ EN KRİTİK İDDİA: yedek en ağır ton. Nötr ya da "uyarı" gösterilseydi
   * okuyan kişi metni yine değerlendirme sanardı; kartın tek işi bu metnin
   * bir AI çıktısı OLMADIĞINI söylemek.
   */
  it("⚠️ yedek köken HATA tonunda — uyarı değil", () => {
    const e = kokenEtiketi(YEDEK_SURUM, YEDEK_MODEL);

    expect(e.durum).toBe("yedek");
    expect(e.ton).toBe("hata");
  });

  it("⚠️ yedek açıklaması AI'ın üretmediğini SÖYLER", () => {
    const e = kokenEtiketi(YEDEK_SURUM, YEDEK_MODEL);

    expect(e.baslik).toContain("üretmedi");
    expect(e.aciklama).toContain("model yanıt vermediği için");
  });

  /*
   * ⚠️ YEDEK İLE ESKİ AYNI CÜMLEYİ KURMAMALI. "Eski sürüm" yeniden üretmenin
   * daha iyi sonuç vereceğini ima eder; yedeğin sebebi ise genellikle AI'ın
   * hiç çalışmamasıdır. İkisini aynı metne indirgemek kullanıcıyı yanlış
   * eyleme iterdi.
   */
  it("⚠️ yedek ile eski FARKLI metin ve FARKLI ton taşır", () => {
    const yedek = kokenEtiketi(YEDEK_SURUM, YEDEK_MODEL);
    const eski = kokenEtiketi("2020-01-v1", "gemini-1.0");

    expect(eski.durum).toBe("eski");
    expect(eski.ton).toBe("uyari");
    expect(yedek.baslik).not.toBe(eski.baslik);
    expect(yedek.aciklama).not.toBe(eski.aciklama);
    expect(yedek.ton).not.toBe(eski.ton);
  });

  /*
   * ⚠️ `null` "eski" DEĞİL: köken sütunları eklenmeden önceki kayıtlar
   * geriye doldurulmadı (#494). Onlara "eski sürüm" demek, güncel olabilecek
   * analizleri ÜCRETLİ bir AI çağrısıyla yeniden ürettirirdi.
   */
  it("⚠️ köken yoksa 'bilinmiyor' — 'eski' denmez, uyarı tonu kullanılmaz", () => {
    for (const deger of [null, undefined, ""]) {
      const e = kokenEtiketi(deger, null);

      expect(e.durum).toBe("bilinmiyor");
      expect(e.ton).toBe("notr");
      expect(e.aciklama).not.toContain("Yeniden üretmek");
    }
  });

  it("model adı yoksa uydurulmaz", () => {
    const e = kokenEtiketi(PROMPT_SURUMU, null);

    expect(e.aciklama).toContain("belirtilmemiş");
  });

  /*
   * ⚠️ #455 DERSİ: metin testleri VARLIĞI ölçer, OKUNABİLİRLİĞİ değil. İlk
   * sürümde başlık kendi içinde tire taşıyordu ve bileşen başlığı açıklamaya
   * yine tireyle bağladığı için satır iki tireli çıkıyordu; açıklama da
   * başlığın sözcüklerini tekrarlıyordu. İkisi de testlerden GEÇMİŞTİ.
   */
  it("⚠️ başlık kendi içinde tire taşımaz — bileşen zaten tireyle bağlıyor", () => {
    for (const surum of [PROMPT_SURUMU, YEDEK_SURUM, "2020-01-v1", null]) {
      expect(kokenEtiketi(surum, "m").baslik).not.toMatch(/[—–-]/);
    }
  });

  it("her durumda başlık ve açıklama DOLU — boş şerit gösterilmesin", () => {
    for (const surum of [PROMPT_SURUMU, YEDEK_SURUM, "2020-01-v1", null]) {
      const e = kokenEtiketi(surum, "m");

      expect(e.baslik.trim().length).toBeGreaterThan(0);
      expect(e.aciklama.trim().length).toBeGreaterThan(0);
    }
  });
});
