import { defineConfig, devices } from "@playwright/test";

/**
 * Uçtan uca testler (#505).
 *
 * ⚠️ NEDEN VAR: kod tabanında 2400'den fazla birim testi vardı ve aynı
 * sınıftan İKİ hata yine de canlıya çıktı — çünkü ikisi de modüllerin
 * İÇİNDE değil ARASINDA yaşıyordu:
 *
 *   - #308: oturum çerezinin adı elle sabitlenmişti; NextAuth adı
 *     `NEXTAUTH_URL`'e göre seçtiği için HTTPS'te giriş yapan herkes
 *     `/signin`'e geri atılıyordu ve bu LOKALDE (http) hiç görünmüyordu.
 *   - #375: oturumsuz kullanıcıyı yönlendiren blok `/api/` kontrolünden
 *     ÖNCE çalışıyordu; her API isteği 307 ile HTML login sayfasına
 *     gidiyordu.
 *
 * Mock'lanmış birim testleri tam da bu birleşimi (middleware + NextAuth +
 * tarayıcı çerezi) atlıyor.
 */

/**
 * ⚠️ ÜRETİM DERLEMESİ ÜZERİNDE KOŞAR, `next dev` DEĞİL.
 *
 * Dev sunucusu React StrictMode ile efektleri iki kez çalıştırıyor ve
 * bazı davranışlar (önbellek, `after()`, statik/dinamik ayrımı) yalnız
 * üretim derlemesinde gerçek hâlini alıyor. Ölçülmüştü: dev modunda
 * "çift istek" sanılan şey üretimde tek istekti.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  /*
   * ⚠️ TEKRAR DENEME YOK — bilerek. Kararsız (flaky) bir E2E'yi yeniden
   * denemek, tam da bu testlerin yakalaması gereken yarış durumlarını
   * gizler. Kararsızlık çıkarsa testin kendisi düzeltilmeli.
   */
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    /*
     * ⚠️ 127.0.0.1, `localhost` DEĞİL: Node 18+ `localhost`'u önce IPv6
     * (::1) çözüyor, sunucu ise IPv4'e bağlanabiliyor — bağlantı sessizce
     * reddedilir ve hata "sayfa açılmadı" gibi görünür.
     */
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      /*
       * ⚠️ `NEXTAUTH_URL` http OLMALI: NextAuth v4 çerez adını buna bakarak
       * seçiyor (https ⇒ `__Secure-` önekli) ve tarayıcı `__Secure-`
       * çerezini http üzerinden KABUL ETMEZ. Yanlış değer, #308'in tam
       * tersi bir kırmızıya yol açar — test hatası, ürün hatası değil.
       */
      NEXTAUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
});
