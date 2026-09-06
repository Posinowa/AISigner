import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { panoErisimineAcik, DURUM_EKRANI } from "./hesap-durumu";

/**
 * #466 — "Bu hesap durumu panoyu görebilir mi" TEK KAYNAKTAN.
 *
 * ⚠️ Kural iki yerde iki farklı yazımla duruyordu (`middleware.ts` ve öğrenci
 * panosu). Bugün aynı şeyi söylüyorlardı; ayrışmaları hata gibi görünmezdi.
 */
describe("panoErisimineAcik", () => {
  it("APPROVED görebilir", () => {
    expect(panoErisimineAcik("APPROVED")).toBe(true);
  });

  it("⚠️ GRADUATED GÖREBİLİR — portfolyo salt-okunur açık kalır (#208)", () => {
    expect(panoErisimineAcik("GRADUATED")).toBe(true);
  });

  it("PENDING göremez", () => {
    expect(panoErisimineAcik("PENDING")).toBe(false);
  });

  it("REJECTED göremez", () => {
    expect(panoErisimineAcik("REJECTED")).toBe(false);
  });

  it("⚠️ TANIMSIZ durum GEÇER — eski jetonlarda alan olmayabilir", () => {
    // Middleware'in önceki davranışı buydu; daraltmak alanı olmayan
    // oturumları toptan kilitlerdi.
    expect(panoErisimineAcik(undefined)).toBe(true);
    expect(panoErisimineAcik(null)).toBe(true);
    expect(panoErisimineAcik("")).toBe(true);
  });

  it("bilinmeyen bir durum GÖREMEZ — varsayılan kapalı", () => {
    expect(panoErisimineAcik("ASKIYA_ALINDI")).toBe(false);
  });

  it("kanonik ekran /account-status", () => {
    expect(DURUM_EKRANI).toBe("/account-status");
  });
});

/**
 * #466 — Öğrenci panosu KENDİ durum ekranını basmamalı.
 *
 * ⚠️ KAYNAK DENETİMİ, davranış testi değil — ve bu bilinçli. Kusur "yanlış
 * ekran basılıyor" değil, "İKİNCİ bir ekran var" idi: kopyada #143'ün
 * 'profilini tamamla' eylemi yoktu ve oraya düşen PENDING stajyer çıkışsız
 * kalıyordu. Bir davranış testi kopyanın VARLIĞINI değil yalnız çıktısını
 * ölçerdi; yeniden eklenen bir kopyayı yakalamazdı.
 *
 * #464'te `mezun-politikasi.test.ts` aynı deseni kullanıyor: "olmayan bir
 * kontrolü kimse sormuyordu" sorununu kaynağı tarayarak çözüyor.
 */
describe("#466 — panoda ikinci bir durum ekranı yok", () => {
  const kaynak = readFileSync(
    join(process.cwd(), "src/app/(student)/student-dashboard/page.tsx"),
    "utf8",
  );

  it("kanonik ekrana yönlendiriyor", () => {
    expect(kaynak).toContain("panoErisimineAcik");
    expect(kaynak).toContain("redirect(DURUM_EKRANI)");
  });

  it("⚠️ kendi 'onay bekliyor' / 'reddedildi' metnini BASMIYOR", () => {
    // Bu metinler kanonik ekranın (#39/#143) sorumluluğunda.
    expect(kaynak).not.toContain("Hesabınız onay bekliyor");
    expect(kaynak).not.toContain("Başvurunuz reddedildi");
  });

  it("⚠️ durum kuralını ELLE yazmıyor", () => {
    // Eski yazım: accountStatus !== "APPROVED" && !isGraduated
    expect(kaynak).not.toContain('accountStatus !== "APPROVED"');
  });
});

describe("#466 — middleware aynı kaynaktan soruyor", () => {
  const kaynak = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");

  it("kuralı tek kaynaktan alıyor", () => {
    expect(kaynak).toContain("panoErisimineAcik");
  });

  it("⚠️ durum kuralını ELLE yazmıyor", () => {
    expect(kaynak).not.toContain('accountStatus !== "GRADUATED"');
  });
});
