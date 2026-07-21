/**
 * #156: Çok adımlı akış göstergesi.
 *
 * Görsel çubuklar `aria-hidden`; ilerleme bilgisi ekran okuyucuya
 * "3 adımdan 2." şeklinde metin olarak verilir. Önceden gösterge yalnızca
 * üç süslü div'den ibaretti ve hangi adımda olunduğu hiç iletilmiyordu.
 */
export function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="mb-6">
      <p className="sr-only">
        {total} adımdan {current}. adımdasınız.
      </p>

      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`h-1.5 rounded-full transition-all ${
              n <= current
                ? "w-10 bg-gradient-to-r from-blue-500 to-indigo-500"
                : "w-6 bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
