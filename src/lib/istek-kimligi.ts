/**
 * İstek kimliği (correlation ID) — #491.
 *
 * ⚠️ NEDEN VAR: bir isteğin ürettiği log satırları birbirine bağlı değildi.
 * #467 ile 46 rota yapısal loglamaya geçti ve yakalanan hatalar bildirim
 * zincirine bağlandı; ama üretimde "şu kullanıcı şu saatte hata aldı"
 * denildiğinde o isteğe ait satırları AYIRT EDECEK bir şey yoktu. Eş
 * zamanlı isteklerin logları iç içe geçiyordu.
 *
 * ⚠️ BU DOSYA EDGE-GÜVENLİ OLMALI: `middleware.ts` Edge çalışma zamanında
 * koşuyor. Buraya `next/headers` ya da Node çekirdek modülü import
 * ETMEYİN — kimliği okuma işi (sunucu tarafı) çağıranda yapılıyor.
 */

/** Taşıyıcı başlık. Vekillerin ve log toplayıcıların bildiği ad. */
export const ISTEK_KIMLIGI_BASLIGI = "x-request-id";

/**
 * Kabul edilebilir kimlik deseni.
 *
 * ⚠️ DIŞARIDAN GELEN KİMLİK DOĞRULANIR. Başlık istemci tarafından
 * uydurulabiliyor ve doğrudan log satırına yazılıyor: serbest metin kabul
 * etmek log enjeksiyonuna (satır sonu, ayraç taklidi) kapı açardı. Ayrıca
 * uzunluk sınırı yoksa dev bir başlık logu şişirebilirdi.
 *
 * Desen kasten dar: harf, rakam, tire, alt tire — UUID ve yaygın izleme
 * kimlikleri (W3C traceparent'ın trace-id kısmı dahil) bu kümede.
 */
const GECERLI_KIMLIK = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Dışarıdan gelen kimliği kabul edilebilirse döner, aksi halde `null`.
 *
 * Vekil ya da çağıran taraf kendi kimliğini gönderdiyse ONU KORUYORUZ:
 * aksi halde aynı istek vekilin logunda başka, bizde başka kimlikle görünür
 * ve correlation'ın amacı kaybolurdu.
 */
export function kimlikNormalize(ham: string | null | undefined): string | null {
  if (!ham) return null;
  const temiz = ham.trim();
  return GECERLI_KIMLIK.test(temiz) ? temiz : null;
}

/** Yeni kimlik üretir. Web Crypto — Edge'de de mevcut. */
export function yeniKimlik(): string {
  return crypto.randomUUID();
}

/**
 * Bu istek için kullanılacak kimliği çözer.
 *
 * Geçerli bir başlık geldiyse onu, gelmediyse yenisini döner.
 */
export function istekKimligiCoz(gelenBaslik: string | null | undefined): string {
  return kimlikNormalize(gelenBaslik) ?? yeniKimlik();
}
