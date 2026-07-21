/**
 * #156: Şifre politikası kuralları — kayıt ve şifre sıfırlama ekranları
 * aynı listeyi ayrı ayrı tanımlıyordu. Sunucudaki politika değişirse tek
 * yerden güncellenebilsin diye ortaklaştırıldı.
 *
 * Sunucu tarafı karşılığı: `api/auth/forgot-password/verify/route.ts` ve
 * `lib/validations/api.ts` içindeki signup şeması.
 */
export const passwordRules = [
  { test: (p: string) => p.length >= 8, label: "En az 8 karakter" },
  { test: (p: string) => /[A-Z]/.test(p), label: "En az bir büyük harf" },
  { test: (p: string) => /[a-z]/.test(p), label: "En az bir küçük harf" },
  { test: (p: string) => /[0-9]/.test(p), label: "En az bir rakam" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "En az bir özel karakter" },
] as const;

/** Sağlanan kural sayısı — ilerleme özetini seslendirmek için. */
export function countMetRules(password: string): number {
  return passwordRules.filter((r) => r.test(password)).length;
}
