import { describe, it, expect } from "vitest";
import { yukEtiketi, yukBandi } from "./yuk-etiketi";

/**
 * #499 — Proje yükünün sunumu.
 *
 * ⚠️ Bu modül BİLEREK `server/yuk.ts`'ten ayrı: o `server-only` ve prisma
 * çekiyor, bu ise mentörün atama ekranında (istemci bileşeni) kullanılıyor.
 * Aynı ayrım #432 ve #448'de de yapılmıştı.
 */
describe("yukEtiketi", () => {
  it("⚠️ SIFIR özel bir durum — 'kimse çalışmıyor'", () => {
    // Mentörün aradığı asıl bilgi bu: boşta duran proje.
    expect(yukEtiketi(0)).toBe("kimse çalışmıyor");
  });

  it("tekil için 'kişi' der, sayıyı tekrar etmez", () => {
    expect(yukEtiketi(1)).toBe("1 kişi çalışıyor");
  });

  it("çoğul", () => {
    expect(yukEtiketi(5)).toBe("5 kişi çalışıyor");
    expect(yukEtiketi(182)).toBe("182 kişi çalışıyor");
  });
});

describe("yukBandi", () => {
  it("kimse yoksa 'bos'", () => {
    expect(yukBandi(0)).toBe("bos");
  });

  it("1-3 arası 'az'", () => {
    expect(yukBandi(1)).toBe("az");
    expect(yukBandi(3)).toBe("az");
  });

  it("4 ve üstü 'yogun'", () => {
    expect(yukBandi(4)).toBe("yogun");
    expect(yukBandi(200)).toBe("yogun");
  });

  /**
   * ⚠️ EŞİKLER TEK YERDE. İki yüzey bu bantları kullanıyor: mentörün atama
   * ekranı ve AI prompt'u. Ayrı yazılsalardı mentörün "az" gördüğü bir proje
   * AI için "yoğun" olabilirdi ve ikisi çelişirdi.
   */
  it("bant sınırları bitişik — arada boşluk yok", () => {
    // 0 -> bos, 1..3 -> az, 4.. -> yogun
    const bantlar = [0, 1, 2, 3, 4, 5].map(yukBandi);
    expect(bantlar).toEqual(["bos", "az", "az", "az", "yogun", "yogun"]);
  });

  it("⚠️ negatif sayı 'bos' DEĞİL — veri bozuksa 'kimse yok' demek yanıltır", () => {
    // Sayaç negatif olmamalı; olursa bunu boş bir proje gibi göstermek
    // mentörü yanlış yönlendirir.
    expect(yukBandi(-1)).not.toBe("bos");
  });
});
