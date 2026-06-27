/**
 * Minimal, süreç-içi sayaç (counter) metrikleri.
 *
 * Amaç: AI fallback oranı gibi operasyonel sinyalleri hafifçe izlemek.
 * Kullanım: incrementCounter("ai_chat.fallback") + getCounter(...) / getCounters().
 *
 * ⚠️ ÖLÇEKLEME: rate-limit gibi bu da süreç-yereldir — her instance kendi sayar
 * ve restart'ta sıfırlanır. Üretimde gerçek bir metrics sink'e (Prometheus,
 * Datadog, OpenTelemetry) taşınmalı; o zaman yalnızca bu modülün gövdesi değişir.
 */

const counters = new Map<string, number>();

/** Bir sayacı `by` kadar artırır (varsayılan 1). */
export function incrementCounter(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

/** Tek bir sayacın güncel değerini döner (yoksa 0). */
export function getCounter(name: string): number {
  return counters.get(name) ?? 0;
}

/** Tüm sayaçların anlık kopyasını döner. */
export function getCounters(): Record<string, number> {
  return Object.fromEntries(counters);
}

/** İki sayacın oranını döner (payda 0 ise 0). İzleme/test için pratik. */
export function getRate(numeratorName: string, denominatorName: string): number {
  const denominator = getCounter(denominatorName);
  if (denominator === 0) return 0;
  return getCounter(numeratorName) / denominator;
}

/** Tüm sayaçları sıfırlar (özellikle testler için). */
export function resetCounters(): void {
  counters.clear();
}
