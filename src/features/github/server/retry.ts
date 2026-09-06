import "server-only";
import { logger } from "@/lib/logger";

/**
 * #218: GitHub çağrıları için sınırlı, saygılı yeniden deneme.
 *
 * GitHub geçici olarak reddedebiliyor: birincil oran sınırı (429), ikincil
 * oran sınırı (403 + `retry-after`) ve sunucu hataları (5xx). Bunlar kalıcı
 * başarısızlık değil; tek denemede pes etmek provisioning'i gereksiz yere
 * yarıda bırakır ve kısmi kurulmuş bir çalışma alanı bırakır.
 *
 * Yeniden DENENMEYENLER bilinçli: 401/403-yetki, 404, 422 gibi durumlar
 * tekrarlansa da aynı sonucu verir; denemek yalnızca gecikme üretir.
 */

/** Denemeler arası bekleme. Testlerde enjekte edilebilsin diye ayrı. */
export type Bekle = (ms: number) => Promise<void>;

const varsayilanBekle: Bekle = (ms) =>
  new Promise((cozumle) => setTimeout(cozumle, ms));

export const VARSAYILAN_DENEME = 3;

/** Üst sınır: `Retry-After` çok büyük gelirse isteği süresiz askıda tutmayalım. */
export const MAKS_BEKLEME_MS = 30_000;

type HataDetay = {
  status?: number;
  response?: { headers?: Record<string, string | undefined> };
};

/** Yeniden denemeye değer mi? */
export function denenebilirMi(error: unknown): boolean {
  const h = error as HataDetay;
  const durum = h?.status;

  if (durum === 429) return true;
  if (typeof durum === "number" && durum >= 500 && durum < 600) return true;

  // İkincil oran sınırı: 403 ama kota bitmemiş olabilir; ayırt edici işaret
  // `retry-after` başlığı ya da tükenmiş `x-ratelimit-remaining`.
  if (durum === 403) {
    const b = h?.response?.headers ?? {};
    return Boolean(b["retry-after"]) || b["x-ratelimit-remaining"] === "0";
  }

  return false;
}

/**
 * Bir sonraki denemeye kadar beklenecek süre.
 *
 * `Retry-After` (saniye) varsa ona saygı duyulur — GitHub ne zaman
 * döneceğimizi bize söylüyor. Yoksa üstel geri çekilme.
 */
export function beklemeSuresiMs(error: unknown, deneme: number): number {
  const h = error as HataDetay;
  const ham = h?.response?.headers?.["retry-after"];

  if (ham !== undefined) {
    const saniye = Number(ham);
    if (Number.isFinite(saniye) && saniye >= 0) {
      return Math.min(saniye * 1000, MAKS_BEKLEME_MS);
    }
  }

  // 1s, 2s, 4s ...
  return Math.min(2 ** (deneme - 1) * 1000, MAKS_BEKLEME_MS);
}

/**
 * `islem`i çalıştırır; geçici hatalarda sınırlı sayıda yeniden dener.
 *
 * Son deneme de başarısız olursa hatayı OLDUĞU GİBİ fırlatır — çağıran taraf
 * `hataNedeni` ile yorumlamayı sürdürebilsin.
 */
export async function yenidenDene<T>(
  islem: () => Promise<T>,
  secenekler: { ad: string; maksDeneme?: number; bekle?: Bekle } = { ad: "github" },
): Promise<T> {
  const maks = secenekler.maksDeneme ?? VARSAYILAN_DENEME;
  const bekle = secenekler.bekle ?? varsayilanBekle;

  let sonHata: unknown;

  for (let deneme = 1; deneme <= maks; deneme++) {
    try {
      return await islem();
    } catch (error) {
      sonHata = error;

      // Kalıcı hata ya da hak bitti → beklemeden çık.
      if (!denenebilirMi(error) || deneme === maks) break;

      const ms = beklemeSuresiMs(error, deneme);
      logger.warn("GitHub çağrısı yeniden denenecek", {
        ad: secenekler.ad,
        deneme,
        maks,
        beklemeMs: ms,
        status: (error as HataDetay)?.status,
      });
      await bekle(ms);
    }
  }

  throw sonHata;
}
