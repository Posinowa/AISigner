// #89: API hata yanıtlarını okunabilir tek bir mesaja indirgeyen ortak yardımcı.
//
// Route'larımız hatayı iki şekilde döndürüyor:
//  - düz string:  { error: "Kendi rolünüzü değiştiremezsiniz." }        (guard/iş kuralı, 4xx/5xx)
//  - zod objesi:  { error: { githubRepoUrl: ["Geçerli bir ... girin"] } } (validation, 400)
// İstemci tarafındaki "sadece string kontrol et" yaklaşımı obje geldiğinde mesajı
// kaybediyordu; bu helper ikisini de doğru gösterir. Admin panelinde ve anket
// akışında paylaşılır.

/**
 * `errorField` bir string ise onu, zod `fieldErrors` objesi ise ilk alan mesajını
 * döndürür; tanınmayan/boş şekillerde `fallback`.
 */
export function extractApiErrorMessage(errorField: unknown, fallback: string): string {
  if (typeof errorField === "string" && errorField.trim().length > 0) {
    return errorField;
  }
  if (errorField && typeof errorField === "object") {
    const firstMessage = Object.values(errorField as Record<string, unknown>).flat()[0];
    if (firstMessage) return String(firstMessage);
  }
  return fallback;
}
