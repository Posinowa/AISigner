"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { useCanliAkis } from "@/features/messaging/ui/useCanliAkis";

/**
 * Adım tamamlandığında kutlama (#329).
 *
 * ⚠️ ASIL DEĞERİ #326 İLE ORTAYA ÇIKIYOR: öğrenci GitHub'da issue'yu
 * kapattığında webhook adımı `COMPLETED` yapıyor. Öncesinde bunu görmesi için
 * sekmeye dönüp sayfayı yenilemesi gerekiyordu — yani platform, öğrencinin
 * GitHub'da yaptığı işi fark etmiyormuş gibi duruyordu. Artık anında görüyor.
 *
 * Kutlama kaybolduğunda ekran DE tazeleniyor (`router.refresh`): animasyon
 * gösterip altındaki listeyi eski bırakmak, tamamlanmamış gibi görünen bir
 * adım demek olurdu.
 */

/** Kutlamanın ekranda kalma süresi. */
const SURE_MS = 4500;

export function AdimKutlamasi() {
  const router = useRouter();
  const [baslik, setBaslik] = useState<string | null>(null);

  /**
   * Açık kapanma zamanlayıcısı (#358).
   *
   * Önceden her olay yeni bir `setTimeout` kuruyor ve hiçbiri iptal
   * edilmiyordu. İki adım arka arkaya tamamlandığında ilk zamanlayıcı
   * İKİNCİ kutlamayı erken kapatıyor, `router.refresh()` de iki kez
   * koşuyordu. Unmount'ta da iptal edilmediği için gezindikten sonra
   * başıboş bir yenileme ateşleniyordu.
   */
  const zamanlayiciRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current);
    };
  }, []);

  useCanliAkis(
    useCallback(
      (olay) => {
        if (olay.tip !== "adim-tamamlandi") return;

        // Önceki kutlama sürüyorsa süresini sıfırdan başlat.
        if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current);

        setBaslik(olay.baslik);
        zamanlayiciRef.current = setTimeout(() => {
          zamanlayiciRef.current = null;
          setBaslik(null);
          // Liste, ilerleme çubuğu ve rozetler tazelensin.
          router.refresh();
        }, SURE_MS);
      },
      [router],
    ),
  );

  if (!baslik) return null;

  return (
    <div
      // Ekran okuyucu da haberdar olsun; görsel bir kutlama tek başına yetmez.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-3 shadow-lg">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
          <PartyPopper className="h-5 w-5 text-emerald-600" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Adım tamamlandı 🎉</p>
          <p className="truncate text-xs text-slate-600">{baslik}</p>
        </div>
      </div>
    </div>
  );
}
