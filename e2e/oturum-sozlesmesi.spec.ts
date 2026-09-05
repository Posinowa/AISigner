import { test, expect } from "@playwright/test";

/**
 * OTURUMSUZ İSTEK SÖZLEŞMESİ (#375, #505).
 *
 * ⚠️ NEDEN E2E: bu sözleşme tek bir modülde yaşamıyor. `middleware.ts`
 * içindeki KONTROL SIRASI ile NextAuth'un çerez okuması birlikte karar
 * veriyor; mock'lanmış birim testleri sırayı hiç görmüyor.
 *
 * #375'te olan tam olarak buydu: `/api/` kontrolü dosyanın SONUNDA
 * duruyordu ("guard.ts zaten koruma sağlıyor" — niyet doğruydu) ama
 * oturumsuz kullanıcıyı `/signin`'e yollayan blok ondan ÖNCE çalışıyordu.
 * Her API isteği 307 ile HTML login sayfasına gidiyordu; `fetch(...).json()`
 * `SyntaxError` fırlatıyor, bileşenler bunu "veri yüklenemedi" diye
 * gösteriyordu — kullanıcı oturumunun düştüğünü ÖĞRENEMİYORDU.
 */

/** Rol/kaynak bakımından farklı üç API ucu — kural yüzeye özel olmamalı. */
const API_UCLARI = [
  "/api/student/proposals",
  "/api/admin/analytics",
  "/api/mentor/analytics",
];

test.describe("oturumsuz istek", () => {
  for (const uc of API_UCLARI) {
    test(`⚠️ ${uc} JSON 401 döner — HTML'e yönlendirmez`, async ({ request }) => {
      /*
       * ⚠️ `maxRedirects: 0` ŞART. Varsayılan davranış yönlendirmeyi İZLER;
       * o zaman bu test 200 + login SAYFASI görür ve #375'i "çalışıyor"
       * sanardı. Kilitlenen şey, ilk yanıtın kendisi.
       */
      const yanit = await request.get(uc, { maxRedirects: 0 });

      expect(yanit.status()).toBe(401);
      expect(yanit.headers()["content-type"]).toContain("application/json");

      const govde = await yanit.json();
      expect(govde).toHaveProperty("error");
    });
  }

  /*
   * ⚠️ YÖNLENDİRME KALDIRILMADI, SIRASI DEĞİŞTİ. #375 düzeltilirken
   * "artık hiçbir şey /signin'e gitmiyor" diye anlaşılabilirdi; SAYFA
   * istekleri hâlâ yönlenmeli, yoksa oturumu düşen kullanıcı boş bir
   * ekranla kalırdı.
   */
  test("korumalı SAYFA /signin'e yönlenir", async ({ page }) => {
    await page.goto("/student-dashboard");

    await expect(page).toHaveURL(/\/signin/);
  });

  /*
   * ⚠️ KÖK YOL GİRİŞE ATMAZ — açılış sayfasını gösterir, ve bu BİLİNÇLİ.
   * `src/app/page.tsx` oturum yokken `LandingPage` basıyor; sayfa hiç
   * oturum verisi almıyor. Buraya bir yönlendirme eklemek platformu
   * tanıtım sayfasız bırakırdı — bu testin işi o kararı korumak.
   */
  test("⚠️ kök yol oturumsuz AÇILIR — girişe atmaz", async ({ page }) => {
    const yanit = await page.goto("/");

    expect(yanit?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/signin/);
    /*
     * ⚠️ `.first()` GEREKLİ ve sebebi ölçüldü: React akışlı (streaming)
     * render sırasında içerik önce `<div hidden id="S:1">` içinde geliyor,
     * sonra yerine taşınıyor. O pencerede `.landing` İKİ öğeye çözülüyor
     * ve Playwright'ın strict modu hata veriyor — ürün hatası değil,
     * zamanlamaya bağlı bir test kusuru. Testin iddiası "açılış sayfası
     * render edildi"; hangi kopyanın görüldüğü bunun parçası değil.
     */
    await expect(page.locator(".landing").first()).toBeVisible();
  });
});

/**
 * ⚠️ PUBLIC YOLLAR OTURUMSUZ AÇILMALI. Bunların her biri bir sebeple
 * public: sertifika doğrulaması QR'dan geliyor (#208), şifre sıfırlama
 * bağlantısı e-postadan tıklanıyor (#262), hukuki metinler herkese açık
 * olmak zorunda (#171/#450). Yeni bir yönlendirme eklerken en kolay
 * kırılacak yer burası.
 */
test.describe("public yollar", () => {
  const PUBLIC = ["/signin", "/signup", "/forgot-password", "/terms", "/privacy"];

  for (const yol of PUBLIC) {
    test(`${yol} oturumsuz açılır`, async ({ page }) => {
      const yanit = await page.goto(yol);

      expect(yanit?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${yol}$`));
    });
  }

  test("⚠️ sertifika doğrulama oturumsuz açılır — bilinmeyen seri no da 'bulunamadı' der", async ({
    page,
  }) => {
    await page.goto("/verify-certificate/BOYLE-BIR-SERI-NO-YOK");

    // Girişe atılmamalı: doğrulamanın bütün değeri oturumsuz çalışması.
    await expect(page).not.toHaveURL(/\/signin/);
    await expect(page.locator("body")).toContainText(/bulunam|geçersiz/i);
  });

  test("/api/health oturumsuz JSON döner", async ({ request }) => {
    const yanit = await request.get("/api/health", { maxRedirects: 0 });

    expect(yanit.status()).toBe(200);
    expect(await yanit.json()).toHaveProperty("status");
  });
});
