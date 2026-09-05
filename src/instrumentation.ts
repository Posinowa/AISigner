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

type IstekBilgisi = {
  path?: string;
  method?: string;
  /**
   * #491: Next bu kancaya istek başlıklarını da veriyor. İstek kimliği
   * buradan okunuyor — yakalanmayan hatalar da aynı kimlikle bildirilsin,
   * yoksa correlation yalnız YAKALANAN hatalarda çalışırdı.
   */
  headers?: Record<string, string | string[] | undefined>;
};
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

    const { ISTEK_KIMLIGI_BASLIGI, kimlikNormalize } = await import(
      "@/lib/istek-kimligi"
    );
    const ham = request.headers?.[ISTEK_KIMLIGI_BASLIGI];
    const istekKimligi =
      kimlikNormalize(Array.isArray(ham) ? ham[0] : ham) ?? undefined;

    await bildirSunucuHatasi(err, {
      istekKimligi,
      // Sorgu dizesi BİLEREK dışarıda: PII sorgu parametrelerinde taşınabiliyor
      // (ör. arama terimi, e-posta). Rota deseni teşhis için zaten yeterli.
      path: request.path?.split("?")[0],
      method: request.method,
      routePath: context.routePath,
    });
  }
}

/** Sayaç yayın aralığı. Teşhis sinyali; sık basmak logu gürültüye boğar. */
const SAYAC_YAYIN_MS = 5 * 60 * 1000;

/**
 * Süreç başına BİR KEZ çalışır (Next'in `register` kancası).
 *
 * ⚠️ NEXT_RUNTIME KORUMASI BURADA DA ZORUNLU — yukarıdaki gerekçenin
 * aynısı: bu dosya edge için de paketleniyor ve `@/lib/logger` zinciri
 * Node çekirdek modüllerine iniyor. Koşulu dışarı almak yetmez, import
 * yine paketlenir.
 *
 * ⚠️ NEDEN BURADA: sayaçlar süreç-yerel, dolayısıyla yayın da süreç
 * düzeyinde olmalı. Bir istek yoluna (ör. #329'un tiki) bağlamak, o yol
 * hiç çalışmadığında (kimse bağlı değilken) sinyali sessizce kaybederdi.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  /*
   * ⚠️ AÇILIŞTA BİR SATIR: yayıcının gerçekten ayağa kalktığını gösteren
   * TEK kanıt bu. Aksi halde sessizce çalışmayan bir teşhis yayıcısı,
   * "sinyal toplanıyor ama kimse görmüyor" durumunun aynısını üretirdi —
   * yani düzeltmeye çalıştığımız şeyi.
   */
  void (async () => {
    try {
      const { logger } = await import("@/lib/logger");
      logger.info("Sayaç yayını başladı", {
        pid: process.pid,
        aralikMs: SAYAC_YAYIN_MS,
      });
    } catch {
      // Açılış logu yazılamazsa da yayın kurulmaya devam etsin.
    }
  })();

  const zamanlayici = setInterval(() => {
    void (async () => {
      try {
        const { sayacOzeti } = await import("@/lib/metrics-raporu");
        const { logger } = await import("@/lib/logger");

        const satirlar = sayacOzeti();
        // Hiçbir şey değişmediyse hiç yazma — sessiz sistem sessiz log.
        if (satirlar.length === 0) return;

        logger.info("Sayaç özeti", {
          // Sayaçlar SÜREÇ-YEREL: çok instance'ta hangi pod'un konuştuğunu
          // ayırt edebilmek gerekiyor, yoksa satırlar birbirine karışır.
          pid: process.pid,
          sayaclar: satirlar,
        });
      } catch {
        // Teşhis yayını hiçbir koşulda uygulamayı etkilemez.
      }
    })();
  }, SAYAC_YAYIN_MS);

  /*
   * `unref`: bu zamanlayıcı tek başına süreci ayakta TUTMAMALI. Aksi halde
   * kapanması gereken bir süreç (test koşusu, kısa ömürlü iş) yayın
   * aralığı kadar asılı kalırdı.
   */
  zamanlayici.unref?.();
}
