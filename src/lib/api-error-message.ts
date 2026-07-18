/**
 * #114: API hata gövdesinden kullanıcıya gösterilecek mesajı çıkarır.
 *
 * API'lerimiz hatayı iki şekilde döner:
 *  - düz string:      `{ error: "Kendi rolünüzü değiştiremezsiniz." }` (guard/iş kuralı)
 *  - zod fieldErrors: `{ error: { title: ["Başlık gerekli"], ... } }` (validasyon)
 *
 * Bu iki şekli tek yerde ele alır; boş/tanımsız/bozuk gövdede fallback döner.
 * Admin sayfalarındaki kopyalanmış inline mantığın tek, test edilen kaynağıdır.
 */
export function extractApiErrorMessage(body: unknown, fallback: string): string {
  const error = (body as { error?: unknown } | null | undefined)?.error;

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    const first = Object.values(error as Record<string, unknown>).flat()[0];
    if (first !== undefined && first !== null && String(first).trim().length > 0) {
      return String(first);
    }
  }

  return fallback;
}
