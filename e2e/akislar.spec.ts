import { test, expect } from "@playwright/test";

import { readFileSync } from "node:fs";

import { AKIS, AKIS_VERI, KIMLIK_DOSYASI, OTURUM_DOSYASI } from "./veri/hesaplar";

/**
 * İŞ AKIŞLARI — mentör, stajyer ve admin ARASINDA yaşayan sözleşmeler.
 *
 * ⚠️ NEDEN E2E: her kuralın birim testi var, ama kullanıcının çarptığı şey
 * rollerin birbirine devrettiği durum. Mentörün yazdığı revizyon gerekçesi
 * stajyerin panosuna düşüyor mu, admin'in mezun etmesi herkese açık
 * doğrulama sayfasını açıyor mu — bunlar tek bir modülde değil.
 *
 * Veri `veri/kur.ts` → `akisVerisiniKur` ile HER KOŞUDA başlangıç durumuna
 * geri yazılıyor; testler durumu değiştirdiği için bu şart.
 */

const [ADIM_1, ADIM_2, ADIM_3] = AKIS_VERI.adimlar;

/*
 * ⚠️ `browser.newContext()` config'teki `use.baseURL`'i DEVRALMIYOR — her
 * bağlama açıkça veriliyor, yoksa göreli adresler "invalid URL" ile düşer.
 * Tek testte iki rol (mentör → stajyer) gerektiği için ayrı bağlam şart.
 */

function kimlikler(): { mezuniyetUserId: string; takimProjesiId: string } {
  return JSON.parse(readFileSync(KIMLIK_DOSYASI, "utf8"));
}

/**
 * ⚠️ TAKIM KÖRLÜĞÜ (#332) — yedi kez tekrarlamış hata sınıfı.
 *
 * Takım atamasında `studentProfileId` NULL. "Mentörün öğrencileri" ve
 * "öğrencinin projeleri" iki yoldan (bireysel bağ + takım) sorulmazsa takım
 * işi SESSİZCE düşüyor: hata vermiyor, yalnız eksik gösteriyor. Bu yüzden
 * iddialar "görünüyor mu" üzerine.
 */
test.describe("takım projesi görünürlüğü (#332)", () => {
  test.describe("mentör", () => {
    test.use({ storageState: OTURUM_DOSYASI("akis-mentor") });

    test("⚠️ yalnız takım üzerinden bağlı stajyer mentör panosunda görünür", async ({ page }) => {
      await page.goto("/mentor-dashboard");

      // Akış B'nin mentöre bireysel bağı YOK; tek yolu takım.
      await expect(page.getByText(AKIS.ogrenciB.email)).toBeVisible();
      await expect(page.getByText(AKIS_VERI.takimSablon).first()).toBeVisible();
    });

    test("takım projesi için AI yol haritası üretimi açıkça reddedilir", async ({ page }) => {
      const yanit = await page.request.post("/api/mentor/generate-roadmap", {
        data: { assignedProjectId: kimlikler().takimProjesiId },
      });

      // Sessiz yedek ya da AI çağrısı değil, açık 400 (CLAUDE.md → Takım).
      expect(yanit.status()).toBe(400);
    });
  });

  test.describe("stajyer", () => {
    test.use({ storageState: OTURUM_DOSYASI("akis-b") });

    test("⚠️ takım projesi üyenin panosunda görünür", async ({ page }) => {
      await page.goto("/student-dashboard");

      await expect(page.getByText(AKIS_VERI.takimSablon).first()).toBeVisible();
    });
  });
});

/**
 * MENTÖR ONAY KAPISI (#379) — revizyon döngüsünün tamamı.
 *
 * ⚠️ SERİ: adımlar sırayla durum değiştiriyor; paralel koşarsa biri
 * diğerinin başlangıç durumunu bozar.
 */
test.describe.serial("revizyon döngüsü (#379)", () => {
  const GEREKCE = "E2E: testler eksik, hata durumu ele alınmamış.";

  test("mentör: kısa gerekçe ve sürmekte olan adım reddedilir", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: OTURUM_DOSYASI("akis-mentor") });

    const kisa = await ctx.request.post(`/api/mentor/steps/${ADIM_1}/revizyon`, {
      data: { gerekce: "kısa" },
    });
    expect(kisa.status()).toBe(400);

    // Yalnız COMPLETED → REVISION_REQUESTED geçişi açık.
    const suren = await ctx.request.post(`/api/mentor/steps/${ADIM_2}/revizyon`, {
      data: { gerekce: GEREKCE },
    });
    expect(suren.status()).toBe(400);

    await ctx.close();
  });

  test("mentör: tamamlanmış adıma gerekçeyle revizyon ister", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: OTURUM_DOSYASI("akis-mentor") });

    const yanit = await ctx.request.post(`/api/mentor/steps/${ADIM_1}/revizyon`, {
      data: { gerekce: GEREKCE },
    });
    expect(yanit.status()).toBe(200);

    await ctx.close();
  });

  test("⚠️ stajyer: gerekçe panosunda görünür", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: OTURUM_DOSYASI("akis-a") });
    const page = await ctx.newPage();

    await page.goto("/student-dashboard");
    await expect(page.getByText(GEREKCE).first()).toBeVisible();

    await ctx.close();
  });

  test("stajyer: revizyondaki adımı doğrudan tamamlayamaz, yeniden başlatıp tamamlar", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL, storageState: OTURUM_DOSYASI("akis-a") });
    const durum = (stepId: string, status: string) =>
      ctx.request.patch(`/api/student/steps/${stepId}`, { data: { status } });

    expect((await durum(ADIM_1, "COMPLETED")).status()).toBe(400);
    expect((await durum(ADIM_1, "IN_PROGRESS")).status()).toBe(200);
    expect((await durum(ADIM_1, "COMPLETED")).status()).toBe(200);

    await ctx.close();
  });

  test("stajyer: önceki adım bitmeden sonraki adım açılmaz", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: OTURUM_DOSYASI("akis-a") });

    // Adım 2 hâlâ sürüyor → adım 3 kilitli.
    const yanit = await ctx.request.patch(`/api/student/steps/${ADIM_3}`, {
      data: { status: "IN_PROGRESS" },
    });
    expect(yanit.status()).toBe(400);

    await ctx.close();
  });
});

/**
 * MEZUNİYET → SERTİFİKA (#208).
 *
 * Sertifika YALNIZ mezuniyette resmileşir (`ensureCertificateIssued`).
 * Herkese açık doğrulama sayfası oturum istemez ve PII göstermez.
 */
test.describe("mezuniyet ve sertifika (#208)", () => {
  test.use({ storageState: OTURUM_DOSYASI("admin") });

  test("⚠️ admin mezun edince sertifika resmileşir ve herkese açık doğrulanır", async ({
    page,
    browser,
    baseURL,
  }) => {
    const { mezuniyetUserId } = kimlikler();

    const mezunEt = await page.request.post("/api/admin/users/approval", {
      data: { userId: mezuniyetUserId, accountStatus: "GRADUATED" },
    });
    expect(mezunEt.status()).toBe(200);

    const sertifika = await page.request.get(
      `/api/admin/students/${mezuniyetUserId}/certificate`,
    );
    expect(sertifika.status()).toBe(200);
    const { certificate } = await sertifika.json();
    expect(certificate.certificateNumber).toBeTruthy();
    expect(certificate.issuedAt).toBeTruthy();

    // Oturumsuz ziyaretçi: işveren bağlantıya tıklıyor.
    const ziyaretci = await browser.newContext({ baseURL });
    const sayfa = await ziyaretci.newPage();
    await sayfa.goto(`/verify-certificate/${certificate.certificateNumber}`);

    await expect(sayfa.getByText(AKIS.mezuniyet.ad).first()).toBeVisible();
    await expect(sayfa.getByText(certificate.certificateNumber).first()).toBeVisible();
    // PII sorguya hiç girmiyor — e-posta sayfada OLMAMALI.
    await expect(sayfa.getByText(AKIS.mezuniyet.email)).toHaveCount(0);

    await ziyaretci.close();
  });
});
