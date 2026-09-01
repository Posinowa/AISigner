"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Sertifikanın doğrulama QR kodu (#323).
 *
 * NEDEN GEREKLİ: Sertifikada doğrulama URL'i zaten yazılı (#280 ile ekranda
 * tıklanabilir de). Ama sertifikanın asıl kullanım biçimi BASILI/PDF: orada
 * bir URL tıklanamaz, elle kopyalanması gerekir. Belgeyi alan işveren
 * doğrulamaya pratikte ulaşamıyordu. QR o boşluğu kapatıyor.
 *
 * NEDEN data URL: Yazdırma akışı (#235) içeriği ayrı bir pencereye kopyalayıp
 * hemen `print()` çağırıyor. Ağdan inen bir görsel o ana yetişemez ve QR boş
 * basılır. Base64 gömülü PNG ağ beklemesi gerektirmiyor.
 */
export function SertifikaQr({
  url,
  boyut = 96,
}: {
  url: string;
  boyut?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;

    QRCode.toDataURL(url, {
      width: boyut * 2, // Retina + yazdırma için 2 kat çözünürlük.
      margin: 1,
      // Yüksek hata düzeltme: basılı belge kırışır, lekelenir, fotokopilenir.
      errorCorrectionLevel: "H",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((d) => {
        if (!iptal) setDataUrl(d);
      })
      .catch(() => {
        // QR üretilemezse sertifika yine geçerli: URL metin olarak duruyor.
        if (!iptal) setDataUrl(null);
      });

    return () => {
      iptal = true;
    };
  }, [url, boyut]);

  if (!dataUrl) return null;

  return (
    /* next/image BİLEREK kullanılmıyor: kaynak zaten base64 data URL, yani
       optimize edilecek bir ağ isteği yok. Ayrıca yazdırma penceresine
       kopyalanan içerikte next/image'in çalışma-anı davranışı geçerli değil. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="Sertifika doğrulama karekodu"
      width={boyut}
      height={boyut}
      style={{ width: boyut, height: boyut }}
      className="rounded-md border border-slate-200 bg-white"
    />
  );
}
