/**
 * #250: Kayıt formunun başvuru tipi — stajyer mi, mentör mü.
 *
 * GÜVENLİK: Rol istemciden geliyor (URL parametresi + gizli form alanı).
 * Bu yüzden değer sunucuda BEYAZ LİSTEYLE çözülür ve tanınmayan her şey
 * en az ayrıcalıklı seçeneğe (stajyer) düşer. `ADMIN` hiçbir girdiyle
 * üretilemez — bu modül yalnızca STUDENT ve MENTOR döndürür.
 *
 * Mentör başvurusu da onaya düşer (accountStatus PENDING); onay kapısı
 * mentörü #249 ile kapsıyor.
 */

export type BasvuruTipi = "stajyer" | "mentor";

export const BASVURU_ALAN_ADI = "basvuruTipi";

/** Tanınmayan/eksik/kurcalanmış her değer "stajyer" olur. */
export function basvuruTipiCoz(ham: unknown): BasvuruTipi {
  if (typeof ham !== "string") return "stajyer";

  // Küçültme locale'den bağımsız olsun diye Türkçe'ye özgü küçültme
  // kullanılmıyor; karşılaştırma sabit bir listeye karşı yapılıyor.
  const t = ham.trim().toLowerCase();
  return t === "mentor" || t === "mentör" ? "mentor" : "stajyer";
}

/** Başvuru tipinin karşılık geldiği rol. ADMIN asla üretilmez. */
export function basvuruRolu(tip: BasvuruTipi): "STUDENT" | "MENTOR" {
  return tip === "mentor" ? "MENTOR" : "STUDENT";
}
