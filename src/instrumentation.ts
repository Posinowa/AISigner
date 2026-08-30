/**
 * Next.js enstrümantasyon kancası.
 *
 * `onRequestError`, sunucu tarafında yakalanmamış HER hatada çağrılır (route
 * handler, server component, server action). Amacımız üretimde bir 500'ün
 * sessizce kaybolmaması: #312 ile loglar yapısal JSON'a geçti ama log yazmak
 * ile HABERDAR OLMAK aynı şey değil — birinin bakması gerekiyor.
 *
 * ⚠️ NEXT_RUNTIME KORUMASINI KALDIRMAYIN.
 *
 * Bu dosya hem Node.js hem **Edge** çalışma zamanı için paketlenir. Bildirim
 * zinciri nodemailer'a kadar iniyor ve nodemailer Node çekirdek modüllerini
 * (`stream`) kullanıyor — edge paketlemesinde bunlar yok. Koruma olmadan build
 * "Module not found: Can't resolve 'stream'" ile patlıyor ve bu YALNIZCA
 * bildirimi değil UYGULAMANIN TAMAMINI kırıyor: her istek 500 dönüyor.
 *
 * `process.env.NEXT_RUNTIME` derleme anında sabite indirgeniyor, bu yüzden
 * `import()` bloğu edge paketinden tamamen eleniyor. Bu, Next'in belgelediği
 * desen — koşulu dışarı almak (erken `return` ile) yetmez, import yine paketlenir.
 */

type IstekBilgisi = { path?: string; method?: string };
type HataBaglami = { routePath?: string };

export async function onRequestError(
  err: unknown,
  request: IstekBilgisi,
  context: HataBaglami,
): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dinamik import: bildirim altyapısı yalnız gerçekten hata olduğunda
    // yüklensin, her soğuk başlangıçta değil.
    const { bildirSunucuHatasi } = await import("@/lib/error-alerts");

    await bildirSunucuHatasi(err, {
      // Sorgu dizesi BİLEREK dışarıda: PII sorgu parametrelerinde taşınabiliyor
      // (ör. arama terimi, e-posta). Rota deseni teşhis için zaten yeterli.
      path: request.path?.split("?")[0],
      method: request.method,
      routePath: context.routePath,
    });
  }
}
