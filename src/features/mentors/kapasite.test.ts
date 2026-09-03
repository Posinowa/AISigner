import { describe, it, expect } from "vitest";
import { kapasiteDurumu, kapasiteEtiketi, kapasiteSinifi } from "./kapasite";

/**
 * #404 — Admin mentör atarken mentörün yükünü göremiyordu.
 *
 * `MentorProfile.capacity` alanı zaten vardı ve HİÇBİR YERDE
 * kullanılmıyordu; açılır listede yalnız ad ve e-posta görünüyordu.
 */
describe("kapasiteDurumu", () => {
  it("kapasitenin altında 'uygun'", () => {
    expect(kapasiteDurumu(2, 5)).toBe("uygun");
  });

  it("kapasiteye eşitse 'dolu'", () => {
    expect(kapasiteDurumu(5, 5)).toBe("dolu");
  });

  it("kapasitenin üstünde 'askin'", () => {
    expect(kapasiteDurumu(7, 5)).toBe("askin");
  });

  /*
   * ⚠️ MentorProfile yalnız başvuru akışında (#287) oluşuyor; seed veya admin
   * eliyle açılan mentörde YOK.
   */
  it("⚠️ kapasite beyan edilmemişse 'bilinmiyor'", () => {
    expect(kapasiteDurumu(3, null)).toBe("bilinmiyor");
  });

  it("sıfır/negatif kapasite de 'bilinmiyor' — sıfıra bölünmüş oran üretilmez", () => {
    expect(kapasiteDurumu(1, 0)).toBe("bilinmiyor");
    expect(kapasiteDurumu(1, -2)).toBe("bilinmiyor");
  });
});

describe("kapasiteEtiketi", () => {
  it("kapasite varsa oran gösterir", () => {
    expect(kapasiteEtiketi(3, 5)).toBe("3/5 stajyer");
  });

  /*
   * ⚠️ Uydurma payda üretmiyoruz: olmayan bir sınırı varmış gibi göstermek,
   * admin'i yanlış bir kesinliğe iter (#328'deki "yüzde skor üretme"
   * kararının aynısı).
   */
  it("⚠️ kapasite YOKSA yalnız sayı — uydurma payda yok", () => {
    expect(kapasiteEtiketi(3, null)).toBe("3 stajyer");
    expect(kapasiteEtiketi(3, null)).not.toContain("/");
  });

  it("kapasite yoksa ve öğrenci de yoksa açık metin", () => {
    expect(kapasiteEtiketi(0, null)).toBe("stajyeri yok");
  });

  it("kapasite varken sıfır öğrenci de oran olarak yazılır", () => {
    expect(kapasiteEtiketi(0, 4)).toBe("0/4 stajyer");
  });
});

describe("kapasiteSinifi", () => {
  it("aşkın ve dolu görsel olarak ayrışır", () => {
    expect(kapasiteSinifi("askin")).not.toBe(kapasiteSinifi("uygun"));
    expect(kapasiteSinifi("dolu")).not.toBe(kapasiteSinifi("uygun"));
    expect(kapasiteSinifi("askin")).not.toBe(kapasiteSinifi("dolu"));
  });

  it("bilinmiyor, uygun ile aynı nötr görünümde", () => {
    expect(kapasiteSinifi("bilinmiyor")).toBe(kapasiteSinifi("uygun"));
  });
});
