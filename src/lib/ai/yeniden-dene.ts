import { incrementCounter } from "@/lib/metrics";
import { logger } from "@/lib/logger";

/**
 * Gemini çağrıları için yeniden deneme (#471).
 *
 * ⚠️ NEDEN VAR: geçici bir hata (503, 429, kopan bağlantı) doğrudan
 * çağıranın `catch` bloğuna düşüyordu ve oradaki davranış MOCK'A DÜŞMEK.
 * Yani bulut tarafındaki saniyelik bir dalgalanma, kullanıcıya jenerik
 * içerik olarak dönüyordu — üstelik #377'nin belgelediği gibi kullanıcı
 * bunu gerçek AI çıktısından AYIRT EDEMİYOR. `code-review` (#327) ise
 * mock'a hiç düşmüyor; orada geçici hata doğrudan "inceleme yok" demek.
 *
 * ## ⚠️ BİLİNMEYEN HATA YENİDEN DENENMEZ
 *
 * Yalnızca TANINAN geçici sinyaller yeniden deneniyor. Varsayılan
 * "denemeye devam et" olsaydı:
 *   - kalıcı bir yapılandırma hatası (kimlik yok, model adı yanlış) her
 *     istekte üç kat gecikme üretirdi,
 *   - içerik güvenlik bloğu gibi DETERMİNİSTİK redler boşuna tekrarlanırdı,
 *   - ve her tekrar ücretli bir çağrı olurdu.
 *
 * Tanımadığımızda tek deneme yapıp hatayı çağırana bırakmak, yanlış
 * yöne düşen bir hatadan ucuz.
 *
 * ## ⚠️ TOPLAM SÜRE SINIRLI
 *
 * Bu çağrılar HTTP isteğinin içinde koşuyor. Üç deneme + üstel bekleme
 * en kötü ihtimalle ~1.5 sn ekliyor ve yalnız HATA yolunda; başarılı
 * istek hiç etkilenmiyor.
 */

/** Toplam deneme sayısı (ilk çağrı dahil). */
const AZAMI_DENEME = 3;

/** İlk bekleme; her denemede ikiye katlanıyor. */
const TABAN_BEKLEME_MS = 500;

/**
 * Geçici olarak TANINAN sinyaller.
 *
 * HTTP kodları ve ağ hatası adları; mesaj metni de taranıyor çünkü SDK
 * hata şeklini sürümler arasında değiştirebiliyor ve tek bir alana
 * bağlanmak sessizce çalışmayı bırakır.
 */
const GECICI_KODLAR = [408, 429, 500, 502, 503, 504];

const GECICI_IZLER = [
  "econnreset",
  "etimedout",
  "econnrefused",
  "eai_again",
  "socket hang up",
  "network error",
  "unavailable",
  "deadline exceeded",
  "overloaded",
  "try again",
  "temporarily",
];

/** Hatadan HTTP durum kodu çıkarmaya çalışır. */
function durumKodu(hata: unknown): number | undefined {
  if (typeof hata !== "object" || hata === null) return undefined;
  const h = hata as Record<string, unknown>;
  for (const alan of ["status", "code", "statusCode"]) {
    const d = h[alan];
    if (typeof d === "number") return d;
    if (typeof d === "string" && /^\d+$/.test(d)) return Number(d);
  }
  return undefined;
}

/**
 * Bu hata yeniden denemeye değer mi?
 *
 * ⚠️ 429 DAHİL: hız sınırı geçicidir ve üstel beklemenin var olma sebebi
 * tam olarak budur. 401/403 (yetki) ve 400 (geçersiz istek) DAHİL DEĞİL —
 * bunlar tekrarlandığında da aynı yanıtı verir.
 */
export function gecicidMi(hata: unknown): boolean {
  const kod = durumKodu(hata);
  if (kod !== undefined) return GECICI_KODLAR.includes(kod);

  const metin = (
    hata instanceof Error ? `${hata.name} ${hata.message}` : String(hata)
  ).toLowerCase();

  // Kod okunamadıysa metinde HTTP kodu geçiyor mu diye bak.
  if (GECICI_KODLAR.some((k) => metin.includes(String(k)))) return true;

  return GECICI_IZLER.some((iz) => metin.includes(iz));
}

/** `setTimeout` tabanlı bekleme — testlerde değiştirilebilsin diye ayrı. */
function varsayilanBekle(ms: number): Promise<void> {
  return new Promise((c) => setTimeout(c, ms));
}

export type YenidenDenemeSecenekleri = {
  /** Sayaç ve log için çağrının adı, ör. "generateContent". */
  kapsam: string;
  /** Testlerde gerçek beklemeyi atlamak için. */
  bekle?: (ms: number) => Promise<void>;
};

/**
 * `islem`'i geçici hatalarda yeniden dener.
 *
 * Son deneme de başarısızsa hata OLDUĞU GİBİ fırlatılır — çağıranın
 * mevcut davranışı (mock'a düşme ya da 500) korunuyor. Bu sarmalayıcı
 * hiçbir hatayı yutmuyor, yalnız geçici olanlara ikinci bir şans veriyor.
 */
export async function yenidenDene<T>(
  islem: () => Promise<T>,
  secenekler: YenidenDenemeSecenekleri,
): Promise<T> {
  const bekle = secenekler.bekle ?? varsayilanBekle;

  for (let deneme = 1; ; deneme++) {
    try {
      const sonuc = await islem();
      if (deneme > 1) {
        // Kaç denemede toparladığı, sessiz bir iyileşmeden daha bilgilendirici.
        incrementCounter("ai.yeniden-deneme.basarili");
        logger.info("AI çağrısı yeniden denemede başarılı", {
          kapsam: secenekler.kapsam,
          deneme,
        });
      }
      return sonuc;
    } catch (hata) {
      const sonDeneme = deneme >= AZAMI_DENEME;

      if (sonDeneme || !gecicidMi(hata)) {
        if (!gecicidMi(hata)) incrementCounter("ai.hata.kalici");
        else incrementCounter("ai.yeniden-deneme.tukendi");
        throw hata;
      }

      incrementCounter("ai.yeniden-deneme");
      /*
       * Üstel bekleme + JİTTER. Jitter olmadan aynı anda hata alan tüm
       * istekler AYNI anda yeniden denerdi; bulut tarafı zaten
       * zorlanıyorken bu, yükü dalgalar hâlinde geri gönderir
       * (thundering herd).
       */
      const taban = TABAN_BEKLEME_MS * 2 ** (deneme - 1);
      await bekle(taban + Math.floor(Math.random() * taban));
    }
  }
}
