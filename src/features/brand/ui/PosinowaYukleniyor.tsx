"use client";

import { useId } from "react";

/**
 * #285: Posinowa logosunun çizilme animasyonu — bekleme göstergesi.
 *
 * Yol, `public/brand/posinowa-logo.webp` dosyasından ÖLÇÜLEREK çıkarıldı,
 * göz kararı çizilmedi: orijinalle piksel karşılaştırmasında %96 örtüşme.
 * Çerçevedeki iki diyagonal boşluk (sağ üst, sol alt) logonun kendi
 * karakteri — ölçümde ikisinin de 43,8 birim genişlikte olduğu çıktı.
 *
 * Çizim `stroke-dashoffset` ile yapılıyor. Desen (`dasharray: L L`) yolu önce
 * baştan doldurup sonra yine baştan sildiği için döngü görünür bir sıçrama
 * olmadan kapanıyor. Yol uzunluğu 2460 — tarayıcıda `getTotalLength()` ile
 * doğrulandı.
 *
 * YALNIZCA bekleme anlarında gösterilir. Sürekli dönen dekoratif bir logo,
 * beklenen bir şey yokken amaçsız hareket olurdu.
 */

/** Ölçülen yol. viewBox 0 0 511 482, çizgi kalınlığı 41. */
const PN_YOLU =
  "M 490 20 L 20 20 L 20 101 L 161 101 " +
  "A 67.5 67.5 0 0 1 161 236 L 20 236 L 20 461 " +
  "L 289 461 L 289 263 L 490 461 Z";

const YOL_UZUNLUGU = 2460;

export function PosinowaYukleniyor({
  boyut = 56,
  className = "",
  etiket = "Yükleniyor",
  /** Dekoratif kullanımda (yanında zaten metin varsa) ekran okuyucudan gizle. */
  dekoratif = false,
}: {
  boyut?: number;
  className?: string;
  etiket?: string;
  dekoratif?: boolean;
}) {
  // Aynı sayfada birden fazla örnek olabilir; maske kimliği çakışmamalı.
  const kimlik = useId();
  const maskeId = `pn-yarik-${kimlik}`;

  return (
    <svg
      viewBox="0 0 511 482"
      width={boyut}
      height={Math.round((boyut * 482) / 511)}
      className={`posinowa-yukleniyor shrink-0 ${className}`}
      {...(dekoratif
        ? { "aria-hidden": true as const }
        : { role: "status" as const, "aria-label": etiket })}
    >
      <defs>
        <mask id={maskeId} maskUnits="userSpaceOnUse" x="0" y="0" width="511" height="482">
          <rect width="511" height="482" fill="#fff" />
          <rect
            x="-100"
            y="-21.9"
            width="200"
            height="43.8"
            fill="#000"
            transform="translate(490,20) rotate(-45)"
          />
          <rect
            x="-100"
            y="-21.9"
            width="200"
            height="43.8"
            fill="#000"
            transform="translate(20,461) rotate(-45)"
          />
        </mask>
      </defs>

      <g mask={`url(#${maskeId})`} fill="none" stroke="currentColor" strokeWidth={41}>
        {/* Şekil bekleme boyunca okunur kalsın diye soluk hayalet. */}
        <path d={PN_YOLU} opacity={0.15} />
        <path
          d={PN_YOLU}
          className="posinowa-kalem"
          strokeDasharray={`${YOL_UZUNLUGU} ${YOL_UZUNLUGU}`}
        />
      </g>
    </svg>
  );
}
