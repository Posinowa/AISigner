import { test, expect } from "@playwright/test";

/**
 * GERÇEK GİRİŞ AKIŞI (#308, #505).
 *
 * ⚠️ NEDEN E2E: #308 canlıyı kırdı ve LOKALDE HİÇ GÖRÜNMEDİ.
 * `authOptions.cookies.sessionToken.name` elle sabitlenmişti; `middleware.ts`
 * oturumu `getToken()` ile okuyor ve NextAuth v4 çerez adını `NEXTAUTH_URL`'e
 * bakarak seçiyor (https ⇒ `__Secure-` önekli). Sonuç: HTTPS'te giriş yapan
 * herkes `/signin`'e geri atılıyordu.
 *
 * ⚠️ BU TEST ÇEREZİN ADINI İDDİA ETMEZ. Adı sabitlemek #308'in ta kendisiydi;
 * adı kilitleyen bir test, hatayı düzeltmek yerine BETONLARDI. Kilitlenen şey
 * DAVRANIŞ: giriş yapan kullanıcı panosunda kalabiliyor ve aynı oturumla API
 * çağırabiliyor.
 */

const HESAP = {
  email: "student@example.com",
  /*
   * Seed'in ürettiği demo şifresi (`scripts/seed.ts`). CI'da `DEMO_PASSWORD`
   * ile açıkça veriliyor; gerçek bir sır değil, atılabilir bir test
   * veritabanına ekilen demo hesap.
   */
  sifre: process.env.DEMO_PASSWORD ?? "geçici_şifre",
};

async function girisYap(page: import("@playwright/test").Page) {
  await page.goto("/signin");
  await page.locator("#signin-email").fill(HESAP.email);
  await page.locator("#signin-password").fill(HESAP.sifre);
  await page.getByRole("button", { name: /giriş/i }).click();
}

test.describe("giriş", () => {
  test("⚠️ giriş sonrası panoda KALIR — girişe geri atılmaz (#308)", async ({ page }) => {
    await girisYap(page);

    await expect(page).toHaveURL(/\/student-dashboard/, { timeout: 20_000 });

    /*
     * ⚠️ ASIL İDDİA BU: #308'de giriş BAŞARILIYDI, kullanıcı bir an panoyu
     * bile görüyordu; middleware çerezi okuyamadığı için SONRAKİ istekte
     * geri atılıyordu. Tek bir yönlendirmeye bakmak hatayı kaçırırdı.
     */
    await page.reload();
    await expect(page).toHaveURL(/\/student-dashboard/);

    await page.goto("/student-dashboard");
    await expect(page).toHaveURL(/\/student-dashboard/);
  });

  test("⚠️ aynı oturumla API isteği 200 JSON döner (#375'in diğer yüzü)", async ({ page }) => {
    await girisYap(page);
    await expect(page).toHaveURL(/\/student-dashboard/, { timeout: 20_000 });

    const yanit = await page.request.get("/api/student/proposals", { maxRedirects: 0 });

    expect(yanit.status()).toBe(200);
    expect(yanit.headers()["content-type"]).toContain("application/json");
  });

  test("oturum açıkken /signin panele yönlendirir", async ({ page }) => {
    await girisYap(page);
    await expect(page).toHaveURL(/\/student-dashboard/, { timeout: 20_000 });

    await page.goto("/signin");

    await expect(page).toHaveURL(/\/student-dashboard/);
  });

  /*
   * ⚠️ `signin` başarılı olunca `/`'a HARD NAVIGATION yapıyor ve yönlendirme
   * kararını sunucudaki `src/app/page.tsx` veriyor (yorumu bunu açıkça
   * söylüyor). Yani kök yol oturum AÇIKKEN oturumsuzdakinden bambaşka
   * davranıyor; ikisini ayrı ayrı kilitlemezsek biri sessizce bozulur.
   */
  test("⚠️ oturum açıkken kök yol açılış sayfası DEĞİL, panodur", async ({ page }) => {
    await girisYap(page);
    await expect(page).toHaveURL(/\/student-dashboard/, { timeout: 20_000 });

    await page.goto("/");

    await expect(page).toHaveURL(/\/student-dashboard/);
  });

  test("yanlış şifre girişi geçirmez", async ({ page }) => {
    await page.goto("/signin");
    await page.locator("#signin-email").fill(HESAP.email);
    await page.locator("#signin-password").fill("kesinlikle-yanlis-sifre");
    await page.getByRole("button", { name: /giriş/i }).click();

    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator("body")).toContainText(/hatal|geçersiz|yanlış/i);
  });
});
