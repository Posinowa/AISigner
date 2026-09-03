/**
 * Öğrencinin "şu an hangi adımdayım" kuralı (#416).
 *
 * ⚠️ KURAL BURADAN SORULUR. Bugüne kadar iki ayrı yerde yaşıyordu:
 * `RoadmapSteps.tsx` içinde gömülü `isLocked`/`isActionable` hesabı ve
 * panodaki "sıradaki adım = tamamlanmamış ilk adım" satırı. Odak kartı
 * üçüncü bir kopya üretseydi, biri güncellenip diğerleri unutulduğunda
 * pano ile liste birbirinden ayrışırdı — bu kod tabanında dört kez yaşanmış
 * bir hata sınıfı (#367/#370/#376/#393).
 *
 * Saf modül: veri çekmiyor.
 */

export type AdimDurumu = "TODO" | "IN_PROGRESS" | "COMPLETED" | "REVISION_REQUESTED" | string;

export type OdakAdimi = { id: string; status: AdimDurumu };

/**
 * Bir önceki adım tamamlandı mı — sırayı açan koşul.
 *
 * Yalnız BİR ÖNCEKİ adıma bakıyor (mevcut davranış korunuyor): ilk adım her
 * zaman açık, sonrakiler bir öncekine bağlı.
 */
export function oncekiTamamlandi(adimlar: OdakAdimi[], indeks: number): boolean {
  return indeks === 0 || adimlar[indeks - 1]?.status === "COMPLETED";
}

/** Sırası gelmemiş adım — öğrenci içeriğini bile görmüyor. */
export function adimKilitli(adimlar: OdakAdimi[], indeks: number): boolean {
  return adimlar[indeks]?.status === "TODO" && !oncekiTamamlandi(adimlar, indeks);
}

/**
 * Öğrenci bu adımda bir şey başlatabilir mi.
 *
 * ⚠️ Revizyondaki adım HER ZAMAN eyleme açık: mentör düzeltilmesini istiyor,
 * sıralama kuralı orada engel olmamalı (#379).
 */
export function adimEylemeAcik(adimlar: OdakAdimi[], indeks: number): boolean {
  const adim = adimlar[indeks];
  if (!adim) return false;
  if (adim.status === "REVISION_REQUESTED") return true;
  return adim.status === "TODO" && oncekiTamamlandi(adimlar, indeks);
}

/**
 * Öğrencinin BUGÜN üzerinde çalışacağı adım.
 *
 * ⚠️ ÖNCELİK SIRASI, "tamamlanmamış ilk adım"dan FARKLI ve bilinçli:
 *
 *  1. **Revizyon istenen adım** — mentör beklemede ve iş geri döndü. Panonun
 *     eski kuralı (tamamlanmamış ilk adım) bunu KAÇIRABİLİYORDU: 1. adım
 *     `IN_PROGRESS`, 2. adım `REVISION_REQUESTED` ise eski kural 1. adımı
 *     gösteriyor, mentörün geri gönderdiği iş görünmüyordu.
 *  2. **Devam eden adım** — öğrenci zaten başlamış.
 *  3. **Eyleme açık ilk adım** — sırası gelmiş ama başlanmamış.
 *
 * Kilitli adım ASLA odak olmaz: öğrenci onda bir şey yapamaz.
 * Hepsi tamamlandıysa `null` — uydurma bir görev göstermek yanıltıcı olurdu.
 */
export function odaktakiAdimIndeksi(adimlar: OdakAdimi[]): number | null {
  const revizyon = adimlar.findIndex((a) => a.status === "REVISION_REQUESTED");
  if (revizyon !== -1) return revizyon;

  const devam = adimlar.findIndex((a) => a.status === "IN_PROGRESS");
  if (devam !== -1) return devam;

  const acik = adimlar.findIndex((_, i) => adimEylemeAcik(adimlar, i));
  return acik === -1 ? null : acik;
}
