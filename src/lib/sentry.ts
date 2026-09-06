import "server-only";

import { HATA_TESHIS } from "@/features/legal/kvkk";
import { logger } from "@/lib/logger";

/**
 * Sunucu hatalarının üçüncü taraf teşhis hizmetine (Sentry) bildirimi (#519).
 *
 * ⚠️ NEDEN VAR: `error-alerts.ts` operatöre e-posta atıyor ve bu bir uyarı
 * kanalı olarak işe yarıyor, ama TEŞHİS aracı değil — gruplama, sıklık,
 * ilk/son görülme, sürüm karşılaştırması yok ve susturma (15 dk) yüzünden
 * tekrarların çoğu hiç görünmüyor. E-posta KALDIRILMADI: SMTP dışında bir
 * bağımlılığa tek kanal olarak güvenmek, hata bildirimini o servisin
 * kesintisinde tamamen kör bırakırdı.
 *
 * ## ⚠️ YALNIZ SUNUCU — TARAYICI SDK'sı BİLEREK YOK
 *
 * İki sebep, ikisi de bu depoda YAZILI:
 *   1. `security-headers.ts` CSP'si `connect-src 'self'` diyor; tarayıcı
 *      SDK'sının gönderimi sessizce engellenirdi.
 *   2. `/privacy` çerez bölümü "analitik veya izleme amaçlı çerez, piksel
 *      ya da üçüncü taraf betiği yok" diye YAYIMLANMIŞ bir hukuki metin.
 *      Tarayıcı SDK'sı bu cümleyi yalanlardı.
 *
 * Bedeli biliniyor: istemci tarafı hataları görünmüyor.
 *
 * ## ⚠️ KAYNAK HARİTASI YÜKLENMİYOR — bilinen borç
 *
 * `withSentryConfig` sarmalayıcısı kullanılmıyor: kaynak haritası yüklemek
 * `SENTRY_AUTH_TOKEN` gerektiriyor ve derlemeyi bir sırra bağlamak ayrı bir
 * karar. Sonuç: yığın çerçeveleri küçültülmüş kodu gösterir. Aksiyon alınan
 * bilgi (hata adı, mesaj, rota deseni, istek kimliği) bunlardan bağımsız ve
 * hepsi taşınıyor.
 *
 * ## ⚠️ SDK STATİK OLARAK IMPORT EDİLMEZ
 *
 * Bu dosyayı `error-alerts.ts` çekiyor, onu `api-hata.ts` çekiyor, onu da
 * 46 rota dosyası. Üstte `import * as Sentry from "@sentry/nextjs"` yazsaydı
 * SDK bu zincirle HER rotanın paketine girerdi — oysa çalışma zamanında
 * yalnız `SENTRY_DSN` tanımlıyken gerekiyor.
 *
 * SDK bu yüzden yalnızca `sentryKur()` içinde, DSN varken dinamik olarak
 * yükleniyor ve tek referans `yakala`da tutuluyor. `instrumentation.ts`
 * zaten aynı sınıftan bir gerekçeyle (edge paketlemesi) dinamik import
 * kullanıyor; bu, o desenin devamı.
 */

type YakalaFn = (hata: unknown, secenekler?: { tags?: Record<string, string> }) => void;

/** `sentryKur()` başarılıysa dolar. SDK'ya tek referans burası. */
let yakala: YakalaFn | null = null;

/** Kişisel veri taşıyabilecek alanlar — Sentry'ye HİÇ gönderilmez. */
const AYIKLANAN_ISTEK_ALANLARI = ["data", "cookies", "headers", "query_string"] as const;

/**
 * ⚠️ İKİ KOŞUL BİRDEN: DSN tanımlı OLMALI **ve** aydınlatma metninde bu
 * hizmet YAZILI olmalı. İkincisi olmadan açılmaz — beyan edilmemiş bir
 * yurt dışı aktarımı yapmaktansa teşhis aracı olmadan yaşamak yeğdir.
 */
export function sentryKurulabilirMi(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim()) && HATA_TESHIS !== null;
}

export async function sentryKur(): Promise<void> {
  if (yakala) return;

  if (!process.env.SENTRY_DSN?.trim()) {
    // Yapılandırılmamış olmak bir hata DEĞİL: özellik kapalı (mail.ts /
    // GCS deseni). Loglamıyoruz, her soğuk başlangıçta gürültü olurdu.
    return;
  }

  if (HATA_TESHIS === null) {
    logger.warn(
      "SENTRY_DSN tanımlı ama aydınlatma metninde hata teşhis sağlayıcısı yazılı değil; Sentry KAPALI",
      { cozum: "features/legal/kvkk.ts → HATA_TESHIS" },
    );
    return;
  }

  const Sentry = await import("@sentry/nextjs");

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.APP_VERSION,

    /*
     * ⚠️ İZLEME (tracing) KAPALI. Performans örneklemesi her isteğe maliyet
     * bindirir ve bu depoda performans zaten ÖLÇÜLEREK yönetiliyor (#452).
     * Açılacaksa ayrı bir karar olmalı, sessiz bir varsayılan değil.
     */
    tracesSampleRate: 0,

    /*
     * ⚠️ VARSAYILAN PII KAPALI. Açık olsaydı SDK istek IP'sini ve çerezleri
     * kendiliğinden ekler; ikisi de kişisel veri ve #321'in "asgari veri"
     * kararına aykırı.
     */
    sendDefaultPii: false,

    beforeSend(olay) {
      /*
       * ⚠️ İKİNCİ KAPI — `sendDefaultPii: false`'a GÜVENMİYORUZ. O bayrak
       * SDK'nın kendi eklediklerini kapatıyor; bizim ya da bir bağımlılığın
       * olaya iliştirdiği gövde/başlık için bir şey söylemiyor. Ayıklama
       * BURADA, gönderimden hemen önce.
       */
      if (olay.request) {
        for (const alan of AYIKLANAN_ISTEK_ALANLARI) {
          delete olay.request[alan];
        }
      }
      delete olay.user;
      // Sorgu dizesi PII taşıyabiliyor (arama terimi, e-posta) — #491'de
      // aynı gerekçeyle log tarafında da ayıklanmıştı.
      if (olay.request?.url) {
        olay.request.url = olay.request.url.split("?")[0];
      }
      return olay;
    },
  });

  yakala = Sentry.captureException as unknown as YakalaFn;
  logger.info("Sentry etkin", { release: process.env.APP_VERSION ?? "-" });
}

/**
 * Hatayı Sentry'ye iletir. Kurulu değilse SESSİZCE geçer.
 *
 * ⚠️ HİÇBİR DURUMDA FIRLATMAZ — `bildirSunucuHatasi` (#380'in bildirim
 * kararıyla aynı ilke) bir yan etki; teşhis aracı yüzünden asıl istek
 * ikinci bir hata almamalı.
 */
export function sentryBildir(hata: unknown, etiketler?: Record<string, string>): void {
  if (!yakala) return;

  try {
    yakala(hata, etiketler ? { tags: etiketler } : undefined);
  } catch (bildirimHatasi) {
    logger.warn("Sentry bildirimi başarısız", {
      hata: bildirimHatasi instanceof Error ? bildirimHatasi.message : String(bildirimHatasi),
    });
  }
}

/** Yalnızca testler için. */
export function sentryDurumunuSifirlaForTests(): void {
  yakala = null;
}
