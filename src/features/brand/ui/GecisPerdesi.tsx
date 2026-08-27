"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PosinowaYukleniyor } from "./PosinowaYukleniyor";

/**
 * #285: Sayfa geçişlerinde basılan perde.
 *
 * İki yerde kullanılıyor:
 * - giriş başarılı olduktan sonra (`signin/page.tsx`), sert yönlendirme ile
 *   sunucu kullanıcıyı kendi paneline gönderene kadar
 * - açılış sayfasındaki CTA'larda (`CizimBaglantisi`), hedef hazırlanırken
 *
 * İkisinde de kullanıcı aksi hâlde hiçbir şey olmuyormuş gibi bir boşluğa
 * bakıyor. Perde o boşluğu dolduruyor ve sistemin çalıştığını gösteriyor.
 *
 * Yalnızca geçiş sırasında basılır; kalıcı bir süs değil.
 */
export function GecisPerdesi({ mesaj = "Panelinize yönlendiriliyorsunuz..." }: { mesaj?: string }) {
  /*
   * Perde <body>'ye PORTAL ile basılıyor, bulunduğu yere değil.
   *
   * Açılış sayfasındaki CTA'ların atası `.landing-rise` bir `transform`
   * taşıyor. Transform'lu bir ata — birim matris bile olsa — `position: fixed`
   * için kapsayıcı blok oluşturuyor; perde bu yüzden tüm ekranı değil,
   * yalnızca o kutuyu kaplıyordu (tarayıcıda ölçüldü). Portal bu bağı kesiyor.
   */
  const [bagli, setBagli] = useState(false);
  useEffect(() => setBagli(true), []);
  if (!bagli) return null;

  return createPortal(
    <div
      // Arkadaki sayfa GÖRÜNMEMELİ: yarı saydam perdede çizim, altındaki
      // sayfanın üstünde yüzüyormuş gibi duruyordu. Tam opak beyaz.
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white"
      role="status"
      aria-live="polite"
    >
      {/* Logo kendi rengiyle: markanın siyahı. Perde beyaz, kontrast tam. */}
      <PosinowaYukleniyor boyut={104} className="text-black" dekoratif />
      <p className="text-sm font-medium text-slate-600">{mesaj}</p>
    </div>,
    document.body,
  );
}
