/**
 * Proje yükünün SUNUM tarafı (#499).
 *
 * ⚠️ `server/yuk.ts` DEĞİL, AYRI DOSYA: o modül `server-only` ve prisma
 * çekiyor. Etiketler mentörün atama ekranında (istemci bileşeni) da
 * kullanılıyor; oradan sunucu modülünü import etmek sunucu kodunu istemci
 * paketine sürüklerdi — #432'de `analytics/sabitler.ts`, #448'de
 * `admin/kategoriler.ts` aynı sebeple ayrılmıştı.
 */

/**
 * Yükü insan diline çevirir.
 *
 * ⚠️ BANT DEĞİL, SAYI + ETİKET. #328'de "uydurma yüzde skor üretme" kararı
 * verilmişti; buradaki sayı ÖLÇÜLMÜŞ bir gerçek, uydurma bir kesinlik değil.
 * Yine de tek başına bir rakam mentöre "çok mu az mı" demiyor — etiket onu
 * söylüyor, sayı da yanında duruyor.
 */
export function yukEtiketi(kisi: number): string {
  if (kisi === 0) return "kimse çalışmıyor";
  if (kisi === 1) return "1 kişi çalışıyor";
  return `${kisi} kişi çalışıyor`;
}

/** Yoğunluk bandı — AI prompt'unda ve arayüz vurgusunda kullanılır. */
export type YukBandi = "bos" | "az" | "yogun";

/**
 * ⚠️ EŞİKLER BURADA, ÇAĞIRANDA DEĞİL. İki yüzey (atama ekranı ve AI önerisi)
 * aynı sınırı kullanmalı; ayrı yazılsalardı mentörün "az" gördüğü bir proje
 * AI için "yoğun" olabilirdi.
 */
export function yukBandi(kisi: number): YukBandi {
  if (kisi === 0) return "bos";
  if (kisi <= 3) return "az";
  return "yogun";
}

/**
 * ⚠️ TEKRARLANABİLİR ŞABLONDA YOĞUNLUK UYARI DEĞİLDİR (#503).
 *
 * Portfolyo sitesinde 200 kişi olması BEKLENEN durumdur — şablon zaten
 * "herkes yapsın" diye işaretlenmiştir. Onu "yogun" saymak mentöre yanlış
 * sinyal verir ve AI'ın ondan kaçınmasına yol açar; oysa #503'ün amacı tam
 * tersi.
 *
 * ⚠️ SAYI YİNE GÖSTERİLİR — kaç kişi olduğu bilgi olarak değerli. Nötrleşen
 * yalnızca "kaçın" anlamı taşıyan BANT.
 */
export function yukBandiSablona(kisi: number, tekrarlanabilir: boolean): YukBandi {
  return tekrarlanabilir ? "az" : yukBandi(kisi);
}
