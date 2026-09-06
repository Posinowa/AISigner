/**
 * Sekmeler arasında TEK bir "lider" seçer (#523).
 *
 * ⚠️ NEDEN VAR — ölçülmüş bir DUVAR. `/api/messages/stream` her sekmede
 * kalıcı açık bir bağlantı tutuyor (#329) ve HTTP/1.1'de tarayıcının origin
 * başına eşzamanlı bağlantı kotası 6. Ölçüldü (üretim derlemesi, standalone
 * sunucu, tek tarayıcı profili):
 *
 *     açık SSE : 0    1    2    3    4    5    6
 *     pano yük.: 272  96  137   88  122   87  ZAMAN AŞIMI (>15 sn)
 *
 * Yavaşlama YOK, duvar var: altıncı sekmede istek hiç başlamıyor. Sunucu
 * suçsuz — aynı deney her sayfa AYRI tarayıcı context'inde (ayrı soket
 * havuzu) tekrarlandığında 10 eşzamanlı akışta hiçbir yavaşlama görülmedi.
 *
 * ⚠️ BELİRTİ HATA GİBİ GÖRÜNMÜYOR: sayfa beyaz kalıyor, konsola bir şey
 * düşmüyor, sunucu logu tertemiz. Teşhisi bu yüzden çok zor.
 *
 * ⚠️ `localStorage` KULLANILMADI, bilerek. Akla ilk gelen "kilit + kalp
 * atışı"nı localStorage'a yazmaktı; ama o depo gizli pencerede ve site
 * verisi kapalıyken ERİŞİMDE fırlatıyor (aynı gerekçe depoda başka yerlerde
 * de yazılı). Seçim tamamen `BroadcastChannel` üzerinden: kalıcı bir şey
 * saklamıyoruz, yalnız yaşayan sekmeler konuşuyor.
 */

/** Kanal adı — origin başına tek. */
const KANAL = "aisigner-canli-akis";

/** Lider bu aralıkla "buradayım" der. */
export const KALP_MS = 2000;

/**
 * Liderden kaç tik üst üste ses çıkmazsa seçim yenilenir.
 *
 * ⚠️ Üç: tek atış kaçırıldığında (sekme arka planda kısılmış olabilir)
 * lider gereksiz yere devrilmemeli.
 *
 * ⚠️ SAAT DEĞİL, TİK SAYILIYOR. `Date.now()` farkına bakan bir sürüm
 * sistem saatinin ileri/geri alınmasından ve arka plan sekmelerinde
 * kısılan zamanlayıcılardan etkilenirdi; burada tek ölçü "kaç turdur
 * sessiz".
 */
export const SESSIZ_TIK_SINIRI = 3;

/** Geriye dönük okunabilirlik için: sessizlik penceresinin süre karşılığı. */
export const LIDER_OLU_MS = KALP_MS * SESSIZ_TIK_SINIRI;

type Mesaj =
  | { t: "kalp"; id: string }
  | { t: "veda"; id: string }
  | { t: "olay"; yuk: unknown }
  | { t: "durum"; bagli: boolean };

export type LiderKanci = {
  /** Bu sekme lider oldu — akışı KUR. */
  liderOldu: () => void;
  /** Bu sekme liderliği bıraktı — akışı KAPAT. */
  liderlikBitti: () => void;
  /** Liderden gelen olay (yalnız takipçilerde çağrılır). */
  olayGeldi: (yuk: unknown) => void;
  /** Liderden gelen bağlantı durumu (yalnız takipçilerde). */
  durumGeldi: (bagli: boolean) => void;
};

export type LiderKontrol = {
  /** Lider olduğumuzda olayları diğer sekmelere yayar. */
  olayYay: (yuk: unknown) => void;
  /** Lider olduğumuzda bağlantı durumunu yayar. */
  durumYay: (bagli: boolean) => void;
  liderMiyim: () => boolean;
  durdur: () => void;
};

/**
 * Tarayıcı desteklemiyorsa `null` döner ve çağıran ESKİ DAVRANIŞA düşer
 * (her sekme kendi akışını kurar).
 *
 * ⚠️ Bu yedek yol KALDIRILAMAZ: `BroadcastChannel` olmayan bir tarayıcıda
 * seçim hiç yapılamaz ve "lider yok" durumunda hiçbir sekme bağlanmazsa
 * mesajlaşma tamamen ölürdü. Altı sekme sınırına takılmak, hiç canlı akış
 * olmamasından iyidir.
 */
export function liderSecimiBaslat(kanca: LiderKanci): LiderKontrol | null {
  if (typeof BroadcastChannel === "undefined") return null;

  let kanal: BroadcastChannel;
  try {
    kanal = new BroadcastChannel(KANAL);
  } catch {
    return null;
  }

  /*
   * ⚠️ Kimlik SIRALANABİLİR olmalı — beraberliği bozan şey bu. İki sekme
   * aynı anda lider olursa (ikisi de sessizlik gördü) küçük kimlik kazanır
   * ve büyük olan kendiliğinden çekilir. Rastgele bir sayı yeterli;
   * `crypto.randomUUID` her ortamda yok.
   */
  const benimId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  let liderim = false;
  /** Liderden ses çıkmadan geçen tik sayısı. */
  let sessizTik = SESSIZ_TIK_SINIRI;
  let liderId: string | null = null;
  let zamanlayici: ReturnType<typeof setInterval> | null = null;
  let durduruldu = false;

  function liderOl() {
    if (liderim) return;
    liderim = true;
    liderId = benimId;
    kanal.postMessage({ t: "kalp", id: benimId } satisfies Mesaj);
    kanca.liderOldu();
  }

  function liderlikBirak() {
    if (!liderim) return;
    liderim = false;
    kanca.liderlikBitti();
  }

  kanal.onmessage = (e: MessageEvent<Mesaj>) => {
    if (durduruldu) return;
    const m = e.data;
    if (!m || typeof m !== "object") return;

    if (m.t === "kalp") {
      if (m.id === benimId) return;
      sessizTik = 0;
      liderId = m.id;
      /*
       * ⚠️ BERABERLİK BURADA ÇÖZÜLÜYOR. İki sekme aynı anda lider olduysa
       * ikisi de kalp atışı yollar; kimliği KÜÇÜK olan kazanır, büyük olan
       * çekilir. Aksi halde iki kalıcı bağlantı açık kalır ve düzeltmeye
       * çalıştığımız sorunun ta kendisi olurdu.
       */
      if (liderim) {
        if (m.id < benimId) {
          liderlikBirak();
        } else {
          /*
           * ⚠️ HEMEN KARŞILIK VER. Yeni açılan sekme İYİMSER davranıp
           * kendini lider ilan ediyor; bizim varlığımızı ancak bir kalp
           * atışı duyunca öğrenir. Sıradaki tike (KALP_MS) bırakırsak o
           * sekme saniyelerce ikinci bir bağlantı açık tutar. Böylece
           * çekilme bir gidiş-dönüş sürüyor.
           */
          kanal.postMessage({ t: "kalp", id: benimId } satisfies Mesaj);
        }
      }
      return;
    }

    if (m.t === "veda") {
      // Lider düzgünce kapandı: beklemeden seçime gir.
      if (m.id === liderId) sessizTik = SESSIZ_TIK_SINIRI;
      return;
    }

    // Aşağısı yalnız TAKİPÇİYİ ilgilendirir; lider kendi yaydığını dinlemez
    // (BroadcastChannel gönderene geri vermez, ama açık olalım).
    if (liderim) return;
    if (m.t === "olay") kanca.olayGeldi(m.yuk);
    else if (m.t === "durum") kanca.durumGeldi(m.bagli);
  };

  function tik() {
    if (durduruldu) return;
    if (liderim) {
      kanal.postMessage({ t: "kalp", id: benimId } satisfies Mesaj);
      return;
    }
    sessizTik += 1;
    if (sessizTik >= SESSIZ_TIK_SINIRI) liderOl();
  }

  zamanlayici = setInterval(tik, KALP_MS);

  /*
   * ⚠️ İYİMSER: SEKME HEMEN LİDER OLUR ve akışı kurar.
   *
   * Akla yatkın alternatif "önce sor, kısa bir süre yanıt bekle" idi ve
   * REDDEDİLDİ: bekleme süresi ne olursa olsun TEK sekmeli oturumda —
   * yani olağan durumda — canlı akış o kadar geç başlardı. Kozmetik bir
   * rozet için her sayfa yüklemesine gecikme eklemek yanlış takas.
   *
   * Bedeli açık ve KISA: zaten bir lider varsa iki bağlantı bir gidiş-dönüş
   * boyunca birlikte açık kalır — mevcut lider yeni kalp atışını duyar
   * duymaz karşılık verir ve büyük kimlikli olan çekilir. Altı bağlantı
   * duvarına ancak altı sekme AYNI ANDA açılırsa değinilir; o da geçici.
   */
  liderOl();

  /*
   * Sekme kapanırken veda et: diğer sekmeler LIDER_OLU_MS beklemeden
   * devralsın. `pagehide` `beforeunload`'a tercih edildi — geri/ileri
   * önbelleğiyle uyumlu ve mobilde gerçekten tetikleniyor.
   */
  const veda = () => {
    if (liderim) kanal.postMessage({ t: "veda", id: benimId } satisfies Mesaj);
  };
  if (typeof window !== "undefined") window.addEventListener("pagehide", veda);

  return {
    olayYay: (yuk) => {
      if (liderim) kanal.postMessage({ t: "olay", yuk } satisfies Mesaj);
    },
    durumYay: (bagli) => {
      if (liderim) kanal.postMessage({ t: "durum", bagli } satisfies Mesaj);
    },
    liderMiyim: () => liderim,
    durdur: () => {
      durduruldu = true;
      veda();
      if (zamanlayici) clearInterval(zamanlayici);

      if (typeof window !== "undefined") window.removeEventListener("pagehide", veda);
      liderim = false;
      try {
        kanal.close();
      } catch {
        // Kapatma hatası akışı ilgilendirmez.
      }
    },
  };
}
