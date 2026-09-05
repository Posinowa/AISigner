import { test, expect } from "@playwright/test";

import { readFileSync } from "node:fs";

import { KIMLIK_DOSYASI, OTURUM_DOSYASI } from "./veri/hesaplar";

/**
 * HESAP DURUMU KAPILARI (#143, #208, #510).
 *
 * ⚠️ NEDEN E2E: kararın tamamı `middleware.ts` içindeki tek bir `blocked`
 * ifadesinde ve `requireAuth`'un seçeneğinde yaşıyor. Birim testleri
 * ikisini ayrı ayrı görüyor; kullanıcının çarptığı şey BİLEŞİMLERİ.
 */


/**
 * #143 — PENDING PROFİL-TAMAMLAMA İSTİSNASI.
 *
 * Stajyer PENDING iken profilini TAMAMLAR; onay bu adımdan SONRA gelir.
 * Yani profil-tamamlama yolları "onaysız STUDENT'ı engelle" kuralının
 * bilinçli istisnası.
 *
 * ⚠️ CLAUDE.md bunu uyarı olarak yazıyor: *"Güvenlik sıkılaştırması"
 * niyetiyle bu uçlara `requireAuth` eklemeden önce buranın istisna
 * olduğunu hatırlayın; aksi halde onboarding tamamen çöker.* Uyarı vardı,
 * testi yoktu — bu dosya o boşluğu kapatıyor.
 */
test.describe("PENDING stajyer (#143)", () => {
  test.use({ storageState: OTURUM_DOSYASI("pending") });

  test("pano ENGELLİ — durum ekranına yönlenir", async ({ page }) => {
    await page.goto("/student-dashboard");

    await expect(page).toHaveURL(/\/account-status/);
  });

  test("⚠️ /profile-setup AÇIK — istisna korunmalı, onboarding buna bağlı", async ({ page }) => {
    await page.goto("/profile-setup");

    await expect(page).toHaveURL(/\/profile-setup/);
    await expect(page).not.toHaveURL(/\/account-status/);
  });

  /*
   * ⚠️ İDDİA "BU URL'DE KALIR" DEĞİL, "DURUM EKRANINA ATILMAZ".
   *
   * Ölçüldü: profili henüz olmayan PENDING stajyer `/student-onboarding`'e
   * gidince sayfanın KENDİSİ `/profile-setup`'a yönlendiriyor — yani sıra
   * doğru işliyor. Kesin URL'i şart koşan bir test, #143'ün kapısı yerine
   * onboarding'in adım sırasını kilitlerdi ve o sıra meşru olarak
   * değişebilir. Kilitlenen şey kapı: middleware bu yolu ENGELLEMİYOR.
   */
  test("⚠️ /student-onboarding AÇIK — istisna korunmalı", async ({ page }) => {
    await page.goto("/student-onboarding");

    await expect(page).not.toHaveURL(/\/account-status/);
    await expect(page).toHaveURL(/\/(student-onboarding|profile-setup)/);
  });

  /*
   * ⚠️ API TARAFI AYRI BİR KAPI. Middleware yalnız SAYFAYI yönlendiriyor;
   * uçları `requireAuth` koruyor ve `allowUnapprovedStudent` yalnız
   * profil-tamamlama uçlarında açık. İkisi ayrı ayrı bozulabilir.
   */
  test("⚠️ profil-tamamlama ucu PENDING'i geçirir, normal öğrenci ucu 403 verir", async ({
    page,
  }) => {
    const acik = await page.request.post("/api/student/survey-answers", {
      data: { answers: [] },
      maxRedirects: 0,
    });
    // Şema/veri yüzünden 400 dönebilir — ÖNEMLİ OLAN 403 OLMAMASI:
    // kapı burada bilerek açık.
    expect(acik.status()).not.toBe(403);

    const kapali = await page.request.get("/api/student/proposals", { maxRedirects: 0 });
    expect(kapali.status()).toBe(403);
  });
});

/**
 * #143 — REJECTED hiçbirine erişemez. PENDING ile aynı kod dalını
 * paylaşıyorlar ve tek fark `accountStatus === "REJECTED"` koşulu; o koşul
 * düşerse REJECTED sessizce PENDING gibi davranmaya başlar.
 */
test.describe("REJECTED stajyer (#143)", () => {
  test.use({ storageState: OTURUM_DOSYASI("rejected") });

  for (const yol of ["/student-dashboard", "/profile-setup", "/student-onboarding"]) {
    test(`${yol} ENGELLİ`, async ({ page }) => {
      await page.goto(yol);

      await expect(page).toHaveURL(/\/account-status/);
    });
  }
});

/**
 * #208 — MEZUN: portfolyo salt-okunur.
 *
 * ⚠️ AYRIM İLKESİ İNCE: *sistem durumunu değiştiren* ve *ücretli AI* uçları
 * kapalı, *insan iletişimi* açık. #437 bu kapının İKİ UÇTA eksik olduğunu
 * buldu — ilke yazılıydı ama uygulaması kaçabiliyordu.
 */
test.describe("GRADUATED stajyer (#208)", () => {
  test.use({ storageState: OTURUM_DOSYASI("mezun") });

  test("pano AÇIK — portfolyo okunabilir", async ({ page }) => {
    await page.goto("/student-dashboard");

    await expect(page).toHaveURL(/\/student-dashboard/);
    await expect(page).not.toHaveURL(/\/account-status/);
  });

  test("sertifika ucu okunur (403 DEĞİL)", async ({ page }) => {
    const yanit = await page.request.get("/api/student/certificate", { maxRedirects: 0 });

    expect(yanit.status()).not.toBe(403);
  });

  test("⚠️ proje önerisi KAPALI — sistem durumunu değiştiren uç (#437)", async ({ page }) => {
    const yanit = await page.request.post("/api/student/proposals", {
      data: { baslik: "E2E", aciklama: "x".repeat(60), kaynak: "BIZIM" },
      maxRedirects: 0,
    });

    expect(yanit.status()).toBe(403);
  });

  test("⚠️ AI sohbeti KAPALI — ücretli AI ucu", async ({ page }) => {
    const yanit = await page.request.post("/api/student/ai-chat", {
      data: { message: "merhaba" },
      maxRedirects: 0,
    });

    expect(yanit.status()).toBe(403);
  });

  /*
   * ⚠️ BU KAPI BİLEREK AÇIK. Mezunun mentörüne/admin'e yazabilmesi meşru
   * ve düşük riskli; #208 bunu açıkça karara bağlamış. "Eksik kapı"
   * sanılıp kapatılmasın diye test EDİLİYOR — #443'ün ofis saati
   * kararında olduğu gibi.
   */
  /*
   * ⚠️ ALICI GERÇEK OLMALI. İlk sürüm uydurma bir kimliğe yazıyordu ve 403
   * alıyordu — ama o 403 `erisim.ts`'ten geliyordu (öğrenci yalnız
   * mentörüne ve admin'e yazabilir), "mezun olduğu için" değil. İki 403
   * ayırt edilemeyince test, ölçmek istediği şeyin TERSİNİ doğruluyordu.
   */
  test("⚠️ mesajlaşma AÇIK — insan iletişimi kapatılmadı", async ({ page }) => {
    const { adminId } = JSON.parse(readFileSync(KIMLIK_DOSYASI, "utf8")) as { adminId: string };

    const yanit = await page.request.post("/api/messages", {
      data: { receiverId: adminId, content: "E2E: mezun mesajlaşma kapısı açık mı?" },
      maxRedirects: 0,
    });

    expect(yanit.status()).not.toBe(403);
  });
});
