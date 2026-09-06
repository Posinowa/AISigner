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
 *
 * ⚠️ KURAL ÖZET ÜZERİNDE TANIMLI, DİZİ ÜZERİNDE DEĞİL (#452).
 *
 * Öncesinde her fonksiyon adım DİZİSİ alıyordu; bu, çağıranı adımları
 * çekmeye MECBUR bırakıyordu. Ölçüldü: `/api/admin/assignments` istek
 * başına 14.241 satır hidratlayıp bundan yalnız 1406 özet üretiyordu ve
 * adımlar yanıtta dönmüyordu bile — sırf sayı hesaplamak için çekiliyorlardı.
 * Sürenin %97'si veritabanında değil, Prisma'nın o satırları JS nesnesine
 * çevirmesindeydi.
 *
 * Çözüm, kuralı KOPYALAMAK değil taşımak oldu: hesap artık
 * `IlerlemeOzeti` üzerinde tanımlı (SQL'in `COUNT`/`MAX` ile doğrudan
 * üretebildiği üç sayı). Diziyle çalışan sürümler `ozetle()`'den geçen
 * ince sarmalayıcılar — yani yüzde formülü, %100 istisnası ve
 * `SESSIZLIK_GUN` eşiği hâlâ TEK yerde yazılı. SQL tarafı için ikinci bir
 * tanım açsaydık #376'daki "kural iki dilde yaşıyor" borcunu gereksiz yere
 * bir kez daha almış olurduk.
 */

export type IlerlemeAdimi = { status: string; updatedAt: Date | string };

/**
 * İlerlemenin dayandığı ÜÇ sayı. SQL'de tek satırda üretilebilir:
 * `COUNT(*)`, `COUNT(*) FILTER (WHERE status = 'COMPLETED')`, `MAX(updatedAt)`.
 */
export type IlerlemeOzeti = {
  toplamAdim: number;
  tamamlanan: number;
  /** En son hareket eden adımın zamanı. Hiç adım yoksa null. */
  sonHareketAt: Date | null;
};

export type Ilerleme = {
  toplamAdim: number;
  tamamlanan: number;
  yuzde: number;
};

/** Adım dizisinden özet üretir — SQL toplaması olmayan çağıranlar için. */
export function ozetle(adimlar: IlerlemeAdimi[]): IlerlemeOzeti {
  return {
    toplamAdim: adimlar.length,
    tamamlanan: adimlar.filter((a) => a.status === "COMPLETED").length,
    sonHareketAt: sonHareket(adimlar),
  };
}

/** Yol haritası yoksa/boşsa %0 — "adım yok" ile "hiç ilerlemedi" ayrımı çağıranda. */
export function ilerlemeOzetten(ozet: IlerlemeOzeti): Ilerleme {
  const { toplamAdim, tamamlanan } = ozet;
  return {
    toplamAdim,
    tamamlanan,
    yuzde: toplamAdim > 0 ? Math.round((tamamlanan / toplamAdim) * 100) : 0,
  };
}

export function ilerlemeHesapla(adimlar: IlerlemeAdimi[]): Ilerleme {
  return ilerlemeOzetten(ozetle(adimlar));
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
export function sessizGunOzetten(
  ozet: IlerlemeOzeti,
  simdi: Date = new Date(),
): number | null {
  if (!ozet.sonHareketAt) return null;
  const t = new Date(ozet.sonHareketAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((simdi.getTime() - t) / 86_400_000);
}

export function sessizGun(adimlar: IlerlemeAdimi[], simdi: Date = new Date()): number | null {
  return sessizGunOzetten(ozetle(adimlar), simdi);
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
 * ⚠️ O erken dönüş DAVRANIŞSAL OLARAK GEREKSİZ, bilerek duruyor: adımsız
 * özette `sonHareketAt` zaten null olduğu için `sessizGunOzetten` null
 * döner ve sonuç yine `false` olurdu. Mutasyon testinde ölçüldü — satırı
 * kaldıran sürümü hiçbir test öldüremiyor, çünkü öldürülecek bir davranış
 * yok. Niyeti okunur kıldığı için korunuyor; bir koruma olduğu iddia
 * EDİLMİYOR.
 */
export function durakladiMiOzetten(
  ozet: IlerlemeOzeti,
  simdi: Date = new Date(),
): boolean {
  if (ozet.toplamAdim === 0) return false;
  if (ilerlemeOzetten(ozet).yuzde === 100) return false;

  const gun = sessizGunOzetten(ozet, simdi);
  return gun !== null && gun >= SESSIZLIK_GUN;
}

export function durakladiMi(adimlar: IlerlemeAdimi[], simdi: Date = new Date()): boolean {
  return durakladiMiOzetten(ozetle(adimlar), simdi);
}

/** Arayüzde basılacak kısa metin. Duraklamamışsa null. */
export function duraklamaMetniOzetten(
  ozet: IlerlemeOzeti,
  simdi: Date = new Date(),
): string | null {
  if (!durakladiMiOzetten(ozet, simdi)) return null;
  return `${sessizGunOzetten(ozet, simdi)} gündür hareket yok`;
}

export function duraklamaMetni(
  adimlar: IlerlemeAdimi[],
  simdi: Date = new Date(),
): string | null {
  return duraklamaMetniOzetten(ozetle(adimlar), simdi);
}
