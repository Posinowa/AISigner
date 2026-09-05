// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { incrementCounter, resetCounters } from "@/lib/metrics";
import { sayacOzeti, sayacOzetiniSifirlaForTests } from "./metrics-raporu";

/**
 * Sayaçların OKUNUR hâle gelmesi (#486).
 *
 * ⚠️ ÖLÇÜLMÜŞ SORUN: kod tabanında 18+ sayaç artırılıyor ama
 * `getCounters()` üretim kodunda HİÇBİR YERDEN çağrılmıyordu. Sinyal
 * toplanıp atılıyordu — "AI ne sıklıkla mock'a düşüyor" sorusunun cevabı
 * süreç belleğinde duruyor ama kimse bakamıyordu.
 */
beforeEach(() => {
  resetCounters();
  sayacOzetiniSifirlaForTests();
});

describe("sayacOzeti", () => {
  it("hiç olay yoksa BOŞ döner — çağıran hiç log yazmasın", () => {
    expect(sayacOzeti()).toEqual([]);
  });

  it("artan sayacı toplam ve artışıyla verir", () => {
    incrementCounter("ai_chat.fallback", 3);

    expect(sayacOzeti()).toEqual([
      { ad: "ai_chat.fallback", toplam: 3, artis: 3 },
    ]);
  });

  it("⚠️ ARTIŞ iki yayın ARASINI anlatır — kümülatif değeri değil", () => {
    // Yalnız kümülatif yayınlansaydı, süreç yeniden başladığında sayaç
    // sıfırlanır ve toplayıcıda "değer düştü" gibi görünürdü.
    incrementCounter("ai.yeniden-deneme", 2);
    sayacOzeti();

    incrementCounter("ai.yeniden-deneme", 5);

    expect(sayacOzeti()).toEqual([
      { ad: "ai.yeniden-deneme", toplam: 7, artis: 5 },
    ]);
  });

  it("⚠️ DEĞİŞMEYEN sayaç tekrar YAYINLANMAZ — gürültülü log okunmaz", () => {
    incrementCounter("storage.delete.failure");
    expect(sayacOzeti()).toHaveLength(1);

    // İkinci yayında hiçbir şey değişmedi.
    expect(sayacOzeti()).toEqual([]);
  });

  it("yalnız DEĞİŞENLER döner, diğerleri sessiz kalır", () => {
    incrementCounter("a");
    incrementCounter("b");
    sayacOzeti();

    incrementCounter("b", 4);

    const ozet = sayacOzeti();
    expect(ozet.map((s) => s.ad)).toEqual(["b"]);
    expect(ozet[0].artis).toBe(4);
  });

  it("birden çok sayaç aynı yayında raporlanır", () => {
    incrementCounter("ai.hata.kalici");
    incrementCounter("ai.yeniden-deneme.tukendi", 2);

    const ozet = sayacOzeti();

    expect(ozet).toHaveLength(2);
    expect(ozet.map((s) => s.ad).sort()).toEqual([
      "ai.hata.kalici",
      "ai.yeniden-deneme.tukendi",
    ]);
  });

  it("`cozVeDogrula`nın DİNAMİK sayaç adları da kapsanır", () => {
    // `ai.${kaynak}.fallback` gibi çalışma anında üretilen adlar; sabit bir
    // liste tutulsaydı bunlar rapora HİÇ girmezdi.
    incrementCounter("ai.generate-roadmap.fallback");
    incrementCounter("ai.code-review.basarili");

    expect(sayacOzeti()).toHaveLength(2);
  });

  it("sayaçlar dışarıdan sıfırlanırsa artış negatife düşer — bilinen sınır", () => {
    /*
     * ⚠️ BU ÜRETİMDE OLMAZ, kasten belgeleniyor.
     *
     * `sonYayin` de sayaçlar da AYNI süreçte yaşıyor; süreç yeniden
     * başladığında ikisi birlikte sıfırlanır ve restart sonrası ilk yayında
     * `artis === toplam` olur. Negatif artış yalnız sayaçlar rapordan
     * BAĞIMSIZ sıfırlandığında görünür — bugün bunu yapan tek şey testler.
     *
     * Kırpma (negatifi sıfıra çekmek) YAPILMADI: gerçekten olursa bunu
     * gizlemek, anlamı bilinmeyen bir sayıyı doğruymuş gibi göstermek olurdu.
     */
    incrementCounter("x", 10);
    sayacOzeti();

    resetCounters();
    incrementCounter("x", 1);

    expect(sayacOzeti()[0]).toEqual({ ad: "x", toplam: 1, artis: -9 });
  });
});
