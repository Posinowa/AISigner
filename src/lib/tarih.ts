/**
 * Tarih ve saat biçimlendirme — TEK KAYNAK (#460).
 *
 * ⚠️ NEDEN VAR: 23 çağrı yeri `toLocaleDateString("tr-TR")` gibi çağrılar
 * yapıyordu ve **hiçbiri `timeZone` vermiyordu**. `Intl` o durumda çalıştığı
 * ORTAMIN saat dilimini kullanır — yani aynı an, kodun nerede çalıştığına göre
 * farklı basılıyordu.
 *
 * Üretimde `TZ` ayarlı değil (Dockerfile/compose'da yok) → konteyner **UTC**,
 * kullanıcı **UTC+3**. Ölçülen sonuçlar:
 *
 *   - **Görüşme saati 3 saat yanlış**: TR saatiyle 14:00'lik bir ofis saati
 *     (#398) panoda **11:00** görünüyordu. `YaklasanGorusme` bir Server
 *     Component içinde render ediliyor.
 *   - **Aynı görüşme iki ekranda iki farklı saat**: `/student-dashboard`
 *     (sunucu) 11:00, `/student-dashboard/ofis-saati` (istemci) 14:00.
 *     Kullanıcının hangisine inanacağını bilmesinin yolu yoktu.
 *   - **Tarihler bir gün geri**: TR saatiyle 21:00–24:00 arasında (günün
 *     %12,5'i) olan her şey. Sertifikanın düzenlenme tarihi dahil — public,
 *     kalıcı ve işverene gösterilen bir belge.
 *
 * ⚠️ BÖLGE SABİT, BİLEREK. `timeZone` her çağrıda AÇIKÇA veriliyor; böylece
 * sunucu ve istemci **aynı çıktıyı** üretiyor (hydration uyuşmazlığı da
 * ortadan kalkıyor). Tarayıcının dilimine bırakmak Server Component'lerde
 * mümkün değil — sunucu kullanıcının dilimini bilmiyor.
 *
 * ⚠️ TÜRKİYE YAZ SAATİ UYGULAMIYOR: `Europe/Istanbul` yıl boyu +03:00
 * (Ocak/Nisan/Temmuz/Ekim ölçüldü, dördü de aynı). #398 bu gerçeğe zaten
 * dayanıyor ("SAAT UTC SAKLANIR, YEREL GÖSTERİLİR") — sabit bir ofset
 * varsaymak burada güvenli.
 *
 * ⚠️ BİLİNEN SINIR: platformun Türkiye merkezli olduğu varsayılıyor (açılış
 * sayfası "81 ilde eşleşme" diyor). Çok bölgeli kullanım hedeflenirse dilim
 * kullanıcı tercihine bağlanmalı — ayrı bir iş, ve o gün değişecek tek yer
 * BURASI olacak.
 */

/** Uygulamanın gösterim saat dilimi. Depolama her zaman UTC. */
export const GOSTERIM_ZAMAN_DILIMI = "Europe/Istanbul";

/** Uygulamanın gösterim yereli. */
export const GOSTERIM_YERELI = "tr-TR";

/**
 * Girdiyi `Date`'e çevirir. Geçersizse `null` — çağıran ne basacağına karar
 * versin. `new Date(undefined)` "Invalid Date" üretip ekrana basılabildiği
 * için sessizce geçirilmiyor.
 */
function tarihe(deger: Date | string | number | null | undefined): Date | null {
  if (deger === null || deger === undefined) return null;
  const d = deger instanceof Date ? deger : new Date(deger);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bicimle(
  deger: Date | string | number | null | undefined,
  secenekler: Intl.DateTimeFormatOptions,
  bosDeger: string,
): string {
  const d = tarihe(deger);
  if (!d) return bosDeger;
  // ⚠️ `timeZone` HER ZAMAN buradan gelir; çağıran seçeneklerle ezemez.
  return new Intl.DateTimeFormat(GOSTERIM_YERELI, {
    ...secenekler,
    timeZone: GOSTERIM_ZAMAN_DILIMI,
  }).format(d);
}

/** "04.09.2026" */
export function tarihBicimle(
  deger: Date | string | number | null | undefined,
  secenekler: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
  bosDeger = "—",
): string {
  return bicimle(deger, secenekler, bosDeger);
}

/** "4 Eylül 2026" — sertifika gibi resmî yüzeyler için. */
export function tarihUzunBicimle(
  deger: Date | string | number | null | undefined,
  bosDeger = "—",
): string {
  return bicimle(deger, { day: "numeric", month: "long", year: "numeric" }, bosDeger);
}

/** "14:00" */
export function saatBicimle(
  deger: Date | string | number | null | undefined,
  secenekler: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
  bosDeger = "—",
): string {
  return bicimle(deger, secenekler, bosDeger);
}

/** "04.09.2026 14:00" */
export function tarihSaatBicimle(
  deger: Date | string | number | null | undefined,
  secenekler: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  bosDeger = "—",
): string {
  return bicimle(deger, secenekler, bosDeger);
}
