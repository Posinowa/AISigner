import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { dogrulamaMesaji } from "./dogrulama-mesaji";

/**
 * #247 — doğrulama geri bildirimi sözleşmesi.
 *
 * Asıl risk sessiz düşme: rota kullanıcıyı `/signin?dogrulama=...` adresine
 * yönlendirir ama ekranda hiçbir şey çıkmazsa, bağlantıya tıklayan kişi
 * doğrulamanın olup olmadığını bilemez.
 */

describe("dogrulamaMesaji", () => {
  it.each([
    ["tamam", "success"],
    ["zaten-dogrulanmis", "success"],
    ["suresi-gecti", "error"],
    ["gecersiz", "error"],
    ["hata", "error"],
  ] as const)("%s durumu %s olarak gösterilir", (durum, variant) => {
    const m = dogrulamaMesaji(durum);
    expect(m).not.toBeNull();
    expect(m!.variant).toBe(variant);
    expect(m!.title.length).toBeGreaterThan(0);
    expect(m!.body.length).toBeGreaterThan(0);
  });

  it("parametre yoksa mesaj gösterilmez", () => {
    expect(dogrulamaMesaji(null)).toBeNull();
    expect(dogrulamaMesaji("")).toBeNull();
  });

  it("bilinmeyen değer için uydurma mesaj üretmez", () => {
    expect(dogrulamaMesaji("kurcalanmis-deger")).toBeNull();
  });

  it("başarı ile hata mesajları birbirinden ayırt edilebilir", () => {
    expect(dogrulamaMesaji("tamam")!.title).not.toBe(
      dogrulamaMesaji("gecersiz")!.title,
    );
  });

  /**
   * Sürüklenme koruması: rotaya yeni bir durum eklenip buraya mesaj
   * eklenmezse kullanıcı boş ekran görür. Bu test o anda kırılır.
   */
  it("rotanın ürettiği HER durumun bir mesajı vardır", () => {
    const rota = readFileSync(
      join(process.cwd(), "src/app/api/auth/verify-email/route.ts"),
      "utf8",
    );

    const durumlar = [...rota.matchAll(/signin\(\s*"([a-z-]+)"/g)].map(
      (m) => m[1],
    );
    const ucluDurumlar = [...rota.matchAll(/\?\s*"([a-z-]+)"\s*:\s*"([a-z-]+)"/g)]
      .flatMap((m) => [m[1], m[2]]);

    const hepsi = [...new Set([...durumlar, ...ucluDurumlar])];
    expect(hepsi.length, "rotadan durum çıkarılamadı — regex bozulmuş").toBeGreaterThanOrEqual(4);

    const eksik = hepsi.filter((d) => dogrulamaMesaji(d) === null);
    expect(eksik, `rotada üretilip mesajı olmayan durum(lar): ${eksik.join(", ")}`).toEqual([]);
  });
});
