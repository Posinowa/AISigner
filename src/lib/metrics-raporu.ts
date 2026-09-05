import { getCounters } from "@/lib/metrics";

/**
 * Sayaçları OKUNUR kılan katman (#486).
 *
 * ⚠️ NEDEN VAR — ÖLÇÜLDÜ: kod tabanında 18+ sayaç artırılıyor
 * (`ai_chat.fallback`, `ai.yeniden-deneme`, `cozVeDogrula`'nın dinamik
 * `ai.<kaynak>.fallback` aileleri, `storage.*`, `provisioning.*`) ve
 * `getCounters()` ÜRETİM KODUNDA HİÇBİR YERDEN ÇAĞRILMIYOR. Yani sinyal
 * toplanıp atılıyordu: "AI ne sıklıkla mock'a düşüyor" sorusunun cevabı
 * süreç belleğinde duruyor ama kimse bakamıyor.
 *
 * ## ⚠️ NEDEN ADMIN UCU DEĞİL
 *
 * Akla ilk gelen `/api/admin/metrics` idi. Yapılmadı: sayaçlar SÜREÇ-YEREL
 * (`metrics.ts` bunu zaten yazıyor) ve platform #322'den beri ÇOK
 * INSTANCE varsayıyor. Bir uç, isteğin düştüğü POD'un sayacını gösterirdi —
 * yani aynı ekran her yenilemede farklı sayı verir ve admin bunu dalgalanma
 * sanardı. Yanlış bir sayı, sayı olmamasından kötü (#328/#331'in "uydurma
 * kesinlik üretme" kararının aynısı).
 *
 * Log ise toplayıcıda pod'lar arası TOPLANABİLİR ve tek instance'ta
 * `docker logs` ile zaten okunur.
 *
 * ## ⚠️ ARTIŞ (DELTA) DA VERİLİYOR
 *
 * Yalnız kümülatif değer yayınlansaydı, süreç yeniden başladığında sayaç
 * sıfırlanır ve toplayıcıda "değer düştü" gibi görünürdü. Artış, iki
 * yayın arasındaki gerçek olay sayısıdır ve restart'tan etkilenmez.
 */

export type SayacSatiri = {
  ad: string;
  /** Süreç başladığından beri toplam. */
  toplam: number;
  /** Bir önceki yayından bu yana artış. */
  artis: number;
};

/** Son yayında bildirilen değerler — artış bundan hesaplanıyor. */
let sonYayin: Record<string, number> = {};

/**
 * Değişen sayaçların özetini döner ve iç anlık görüntüyü ilerletir.
 *
 * ⚠️ YALNIZ DEĞİŞENLER. Her yayında 18 sayacın tamamını basmak, çoğu sıfır
 * kalırken logu gürültüye boğardı ve gürültülü log okunmayan logdur.
 * Hiçbir şey değişmediyse BOŞ dizi döner — çağıran taraf hiç log yazmaz.
 */
export function sayacOzeti(): SayacSatiri[] {
  const guncel = getCounters();
  const satirlar: SayacSatiri[] = [];

  for (const [ad, toplam] of Object.entries(guncel)) {
    const onceki = sonYayin[ad] ?? 0;
    if (toplam === onceki) continue;
    satirlar.push({ ad, toplam, artis: toplam - onceki });
  }

  /*
   * ⚠️ ANLIK GÖRÜNTÜ `guncel`'in KOPYASI, referansı değil.
   * `getCounters()` her çağrıda yeni nesne döndürüyor ama buna güvenmek
   * kırılgan olurdu: uygulaması değişirse artışlar sessizce hep sıfır
   * çıkardı ve bu bir hata gibi görünmezdi.
   */
  sonYayin = { ...guncel };

  return satirlar;
}

/** Yalnızca testler için: artış tabanını sıfırlar. */
export function sayacOzetiniSifirlaForTests(): void {
  sonYayin = {};
}
