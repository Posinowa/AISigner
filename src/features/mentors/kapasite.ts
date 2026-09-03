/**
 * Mentörün anlık yükünün gösterimi (#404).
 *
 * Saf modül: veri çekmiyor.
 *
 * ⚠️ KAPASİTE BEYAN EDİLMEMİŞSE ORAN GÖSTERİLMEZ. `MentorProfile` yalnız
 * başvuru akışında (#287) oluşuyor; seed veya admin eliyle açılan mentörde
 * yok. "3/1" gibi uydurma bir payda üretmek, olmayan bir sınırı varmış gibi
 * gösterirdi.
 */

export type KapasiteDurumu = "uygun" | "dolu" | "askin" | "bilinmiyor";

export function kapasiteDurumu(aktif: number, kapasite: number | null): KapasiteDurumu {
  if (kapasite === null || kapasite <= 0) return "bilinmiyor";
  if (aktif > kapasite) return "askin";
  if (aktif === kapasite) return "dolu";
  return "uygun";
}

/** Açılır listede adın yanında görünen kısa yük etiketi. */
export function kapasiteEtiketi(aktif: number, kapasite: number | null): string {
  if (kapasite === null || kapasite <= 0) {
    return aktif === 0 ? "stajyeri yok" : `${aktif} stajyer`;
  }
  return `${aktif}/${kapasite} stajyer`;
}

/**
 * Aşkın/dolu mentörü görsel olarak ayırmak için sınıf.
 *
 * ⚠️ ENGELLEME YOK — yalnız görünürlük. Bir mentöre kapasitesinin üzerinde
 * stajyer atamak meşru olabilir (geçici devir, kısa süreli destek); son söz
 * admin'in. Sayı, kararı almasına yardım etsin diye orada.
 */
export function kapasiteSinifi(durum: KapasiteDurumu): string {
  switch (durum) {
    case "askin":
      return "text-red-700";
    case "dolu":
      return "text-amber-700";
    default:
      return "text-slate-500";
  }
}
