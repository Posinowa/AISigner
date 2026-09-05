import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

import { E2E_PAROLA, OTURUMLAR, OTURUM_DOSYASI } from "./hesaplar";

/**
 * Oturumları BİR KEZ kurar (#510).
 *
 * ⚠️ NEDEN: her test kendi girişini yapınca toplu koşu düşüyordu — tek
 * tek çalışan testler birlikte kırmızıya dönüyordu. Sebep ürün hatası
 * değil, giriş RATE-LIMIT'i (`nextauth.ts`): paralel worker'lar aynı
 * IP'den arka arkaya giriş deniyor ve "yanlış şifre" testi sayacı ayrıca
 * artırıyor.
 *
 * ⚠️ Bu, limiti test etmekten KAÇMAK değil: limit `giris.spec.ts`'te
 * gerçek giriş akışıyla zaten kapsanıyor. Buradaki testlerin konusu
 * HESAP DURUMU kapıları; her birinin ayrıca giriş yapması testin
 * konusuna bir yan koşul ekliyordu.
 */
for (const { ad, email } of OTURUMLAR) {
  setup(`oturum: ${ad}`, async ({ page }) => {
    await page.goto("/signin");
    await page.locator("#signin-email").fill(email);
    await page.locator("#signin-password").fill(E2E_PAROLA);
    await page.getByRole("button", { name: /giriş/i }).click();

    // Giriş gerçekten oldu mu: signin'den çıkmadan durumu kaydetmek,
    // sonraki testlere BOŞ bir oturum devretmek olurdu.
    await page.waitForURL((url) => !url.pathname.startsWith("/signin"), { timeout: 20_000 });
    expect(page.url()).not.toContain("/signin");

    mkdirSync(".oturum", { recursive: true });
    await page.context().storageState({ path: OTURUM_DOSYASI(ad) });
  });
}
