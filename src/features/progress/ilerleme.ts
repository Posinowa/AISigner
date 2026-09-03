import { SESSIZLIK_GUN } from "@/features/analytics/sabitler";

/**
 * Bir atamanın ilerlemesi ve duraklaması (#432).
 *
 * ⚠️ NEDEN AYRI MODÜL: Hesap `admin/server/assignment-progress.ts` içinde
 * gömülüydü ve mentör panosunda hiç yoktu. Mentör tarafı için ikinci bir
 * kopya yazmak, bu kod tabanında DÖRT KEZ yaşanmış hata sınıfını tekrarlamak
 * olurdu (#367/#370/#376/#393): aynı kural iki yerde, biri güncellenip
 * diğeri unutulunca sessizce ayrışır.
 *
 * Saf modül: veri ÇEKMİYOR.
 */

export type IlerlemeAdimi = { status: string; updatedAt: Date | string };

export type Ilerleme = {
  toplamAdim: number;
  tamamlanan: number;
  yuzde: number;
};

/** Yol haritası yoksa/boşsa %0 — "adım yok" ile "hiç ilerlemedi" ayrımı çağıranda. */
export function ilerlemeHesapla(adimlar: IlerlemeAdimi[]): Ilerleme {
  const toplamAdim = adimlar.length;
  const tamamlanan = adimlar.filter((a) => a.status === "COMPLETED").length;
  return {
    toplamAdim,
    tamamlanan,
    yuzde: toplamAdim > 0 ? Math.round((tamamlanan / toplamAdim) * 100) : 0,
  };
}

/** En son hareket eden adımın zamanı. Hiç adım yoksa null. */
export function sonHareket(adimlar: IlerlemeAdimi[]): Date | null {
  let enYeni: number | null = null;
  for (const a of adimlar) {
    const t = new Date(a.updatedAt).getTime();
    if (Number.isNaN(t)) continue;
    if (enYeni === null || t > enYeni) enYeni = t;
  }
  return enYeni === null ? null : new Date(enYeni);
}

/** Son hareketten bu yana geçen tam gün. Hiç hareket yoksa null. */
export function sessizGun(adimlar: IlerlemeAdimi[], simdi: Date = new Date()): number | null {
  const son = sonHareket(adimlar);
  if (!son) return null;
  return Math.floor((simdi.getTime() - son.getTime()) / 86_400_000);
}

/**
 * Atama "duraklamış" mı — mentörün/adminin görmesi gereken sinyal.
 *
 * ⚠️ SKOR DEĞİL SİNYAL (#331/#397 kararı). "%73 risk" gibi uydurma bir
 * kesinlik üretilmiyor; gösterilen şey verinin kendisi: "10 gündür hareket
 * yok". Eşik de analitikteki `SESSIZLIK_GUN` ile AYNI — iki farklı sayı,
 * aynı olguyu iki yerde farklı tanımlamak olurdu ve kullanıcı hangi ekrana
 * baktığına göre farklı cevap alırdı.
 *
 * ⚠️ TAMAMLANMIŞ İŞ DURAKLAMIŞ SAYILMAZ. Bitmiş bir projede hareket
 * olmaması normaldir; mezun stajyerin portfolyosu (#208) aksi halde
 * baştan sona "duraklamış" görünürdü.
 *
 * ⚠️ HİÇ ADIM YOKSA duraklamış değil: orada sorun yol haritasının olmaması
 * ya da yayınlanmamış olması (#405) — farklı bir uyarı, arayüz onu ayrıca
 * yazıyor.
 *
 * ⚠️ O erken dönüş DAVRANIŞSAL OLARAK GEREKSİZ, bilerek duruyor: boş
 * listede `sessizGun` zaten `null` döndüğü için sonuç yine `false` olurdu.
 * Mutasyon testinde ölçüldü — satırı kaldıran sürümü hiçbir test
 * öldüremiyor, çünkü öldürülecek bir davranış yok. Niyeti okunur kıldığı
 * için korunuyor; bir koruma olduğu iddia EDİLMİYOR.
 */
export function durakladiMi(
  adimlar: IlerlemeAdimi[],
  simdi: Date = new Date(),
): boolean {
  if (adimlar.length === 0) return false;
  if (ilerlemeHesapla(adimlar).yuzde === 100) return false;

  const gun = sessizGun(adimlar, simdi);
  return gun !== null && gun >= SESSIZLIK_GUN;
}

/** Arayüzde basılacak kısa metin. Duraklamamışsa null. */
export function duraklamaMetni(
  adimlar: IlerlemeAdimi[],
  simdi: Date = new Date(),
): string | null {
  if (!durakladiMi(adimlar, simdi)) return null;
  return `${sessizGun(adimlar, simdi)} gündür hareket yok`;
}
