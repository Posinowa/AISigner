/**
 * #253: Proje şablonu üzerinde kimin söz sahibi olduğu.
 *
 * Mentörler artık şablon oluşturabiliyor. Düzenleme/silme yetkisi SAHİPLİKLE
 * sınırlı: mentör yalnızca kendi oluşturduğunu değiştirebilir. Admin hepsini
 * yönetmeyi sürdürür.
 *
 * Sahibi olmayan (createdById === null) şablonlar — #253 öncesi oluşturulmuş
 * olanlar — yalnızca admin'e açıktır. Aksi halde herhangi bir mentör
 * sistemdeki tüm eski şablonları silebilirdi.
 */

export type YetkiKullanicisi = {
  // Oturum tipinde `id` opsiyonel; kimliksiz kullanıcı hiçbir şeye
  // sahip olamayacağı için burada açıkça ele alınıyor.
  id?: string | null;
  role?: string | null;
};

export type YetkiSablonu = {
  createdById: string | null;
};

/** Şablonu düzenleyip silebilir mi? */
export function sablonuYonetebilir(
  kullanici: YetkiKullanicisi,
  sablon: YetkiSablonu,
): boolean {
  if (kullanici.role === "ADMIN") return true;
  if (kullanici.role !== "MENTOR") return false;

  // Sahipsiz şablon mentöre kapalı.
  if (!sablon.createdById) return false;
  // Kimliksiz oturum sahiplik iddia edemez.
  if (!kullanici.id) return false;

  return sablon.createdById === kullanici.id;
}

/** Şablon oluşturabilir mi? */
export function sablonOlusturabilir(kullanici: YetkiKullanicisi): boolean {
  return kullanici.role === "ADMIN" || kullanici.role === "MENTOR";
}
