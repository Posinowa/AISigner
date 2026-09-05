/**
 * Adım kaynaklarının düzenlenmesi — TEK KAYNAK (#494).
 *
 * ⚠️ NEDEN VAR: Yol haritası sayfasında bu üç işlem İKİ KEZ yazılıydı —
 * `addEditResource`/`addNewResource`, `removeEditResource`/`removeNewResource`,
 * `updateEditResource`/`updateNewResource`. Gövdeleri birbirinin aynısıydı;
 * tek fark hangi state setter'ına yazdıklarıydı.
 *
 * Bugün ikisi tesadüfen aynı davranıyordu. Biri güncellenip diğeri
 * unutulduğunda mentör, adımı DÜZENLERKEN ve YENİ EKLERKEN farklı davranan
 * iki form görürdü — ve bu **hata gibi görünmezdi**, çünkü her iki form da
 * kendi içinde tutarlı çalışmaya devam ederdi. Bu kod tabanında tekrar eden
 * hata sınıfı (#367/#370/#376/#393/#442/#449/#464/#466/#489).
 *
 * Saf fonksiyonlar: diziyi değiştirmez, YENİSİNİ döndürür — React state'i
 * yerinde değiştirmek yeniden render'ı kaçırır.
 */

/** Sona boş bir kaynak satırı ekler. */
export function kaynakEkle(kaynaklar: string[]): string[] {
  return [...kaynaklar, ""];
}

/**
 * Verilen sıradaki kaynağı kaldırır.
 *
 * ⚠️ SON SATIR DA KALDIRILABİLİR (boş liste meşru): formlar kaydederken
 * boşları zaten süzüyor (`filter(r => r.trim() !== "")`), yani "en az bir
 * satır kalsın" kuralı burada DEĞİL. Aksi halde mentör tek kaynağı silmek
 * isteyip silemezdi.
 */
export function kaynakKaldir(kaynaklar: string[], index: number): string[] {
  return kaynaklar.filter((_, i) => i !== index);
}

/** Verilen sıradaki kaynağı değiştirir; sıra dışıysa liste aynen döner. */
export function kaynakGuncelle(
  kaynaklar: string[],
  index: number,
  deger: string,
): string[] {
  if (index < 0 || index >= kaynaklar.length) return kaynaklar;
  const yeni = [...kaynaklar];
  yeni[index] = deger;
  return yeni;
}
