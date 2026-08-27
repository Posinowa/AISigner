"use client";

/**
 * #285: Posinowa logosunun çizilme animasyonu — bekleme göstergesi.
 *
 * Çizilen şey logonun DIŞ HATTI. Kalem silüetin sınırını dolaşıyor, içi boş
 * kalıyor; kalem ucuyla çizilmiş bir eskiz gibi görünmesinin sebebi bu.
 * (İlk denemede logonun orta çizgisi 41 birim kalınlıkta çizilmişti; o
 * kalınlık şeklin içini tamamen doldurduğu için "çizim" değil, dolu bir
 * damga gibi duruyordu.)
 *
 * Hat `public/brand/posinowa-logo.webp` dosyasından ÖLÇÜLEREK çıkarıldı,
 * göz kararı çizilmedi: piksel maskesi marching-squares ile taranıp RDP ile
 * sadeleştirildi, sonuç orijinalle %98,8 örtüşüyor. Logo iki AYRI kapalı
 * halkadan oluşuyor — çerçevedeki diyagonal boşluklar bu ayrımın kendisi,
 * yani ayrıca maskelemek gerekmiyor.
 *
 * Çizim `stroke-dashoffset` ile yapılıyor. Desen (`dasharray: L L`) yolu önce
 * baştan doldurup sonra yine baştan sildiği için döngü görünür bir sıçrama
 * olmadan kapanıyor.
 *
 * YALNIZCA bekleme anlarında gösterilir. Sürekli dönen dekoratif bir logo,
 * beklenen bir şey yokken amaçsız hareket olurdu.
 */

/** Ölçülen dış hat. İki halka: "P" gövdesi ve "N" gövdesi. */
const PN_HAT =
  "M 0 0 L 482 1 L 471 9 L 445 35 L 442 40 L 41 40 L 41 81 L 176 81 L 198 86 " +
  "L 219 97 L 235 113 L 245 132 L 250 153 L 250 183 L 244 207 L 234 225 " +
  "L 222 238 L 200 251 L 183 256 L 163 258 L 40 258 L 40 410 L 32 418 L 30 418 " +
  "L 0 449 L 0 216 L 175 215 L 190 209 L 198 202 L 205 191 L 209 172 L 207 154 " +
  "L 201 141 L 191 131 L 173 124 L 0 123 L 0 0 Z " +
  "M 510 34 L 511 482 L 480 482 L 476 477 L 474 477 L 329 332 L 329 330 " +
  "L 312 313 L 310 313 L 310 482 L 30 482 L 31 479 L 69 442 L 269 442 L 269 265 " +
  "L 274 251 L 279 246 L 288 243 L 298 244 L 307 249 L 470 411 L 470 73 " +
  "L 500 42 L 502 42 L 510 34 Z";

/** İki halkanın toplam uzunluğu; hat çıkarılırken hesaplandı. */
const YOL_UZUNLUGU = 4823;

/**
 * viewBox logonun 511x482'lik kutusundan biraz geniş: çizgi hattın ÜZERİNDE
 * ortalandığı için payı olmasa dış yarısı kırpılırdı.
 */
const PAY = 14;

export function PosinowaYukleniyor({
  boyut = 56,
  className = "",
  etiket = "Yükleniyor",
  /** Hat kalınlığı. 20, 18 px'te görünür kalıp 160 px'te ince hat olarak duruyor. */
  cizgi = 20,
  /** Dekoratif kullanımda (yanında zaten metin varsa) ekran okuyucudan gizle. */
  dekoratif = false,
}: {
  boyut?: number;
  className?: string;
  etiket?: string;
  cizgi?: number;
  dekoratif?: boolean;
}) {
  const genislik = 511 + PAY * 2;
  const yukseklik = 482 + PAY * 2;

  return (
    <svg
      viewBox={`${-PAY} ${-PAY} ${genislik} ${yukseklik}`}
      width={boyut}
      height={Math.round((boyut * yukseklik) / genislik)}
      className={`posinowa-yukleniyor shrink-0 ${className}`}
      /**
       * Keyframes iki UÇ değeri de düz sayı olarak okumalı. `calc()` ile
       * negatifi hesaplatmak tarayıcıda ölçüldü: hesaplanan değer `calc()`
       * olarak kaldığı için ara değer üretilmiyor, animasyon iki uç arasında
       * SIÇRIYOR. İkinci değişken bu yüzden var.
       */
      style={
        {
          "--pn-uzunluk": YOL_UZUNLUGU,
          "--pn-eksi": -YOL_UZUNLUGU,
        } as React.CSSProperties
      }
      {...(dekoratif
        ? { "aria-hidden": true as const }
        : { role: "status" as const, "aria-label": etiket })}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={cizgi}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Şekil bekleme boyunca okunur kalsın diye soluk hayalet. */}
        <path d={PN_HAT} opacity={0.15} />
        <path
          d={PN_HAT}
          className="posinowa-kalem"
          strokeDasharray={`${YOL_UZUNLUGU} ${YOL_UZUNLUGU}`}
        />
      </g>
    </svg>
  );
}
