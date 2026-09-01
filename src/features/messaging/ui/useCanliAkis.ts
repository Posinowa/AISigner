"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Canlı akışa bağlanan istemci kancası (#329).
 *
 * ⚠️ YOKLAMA YEDEĞİ KALDIRILMADI, KOŞULLU HALE GETİRİLDİ.
 * SSE bir vekil, kurumsal güvenlik duvarı ya da tarayıcı eklentisi tarafından
 * kesilebilir. Akış çalışmıyorken mesajlaşmanın TAMAMEN durması, 5 saniyelik
 * gecikmeden çok daha kötü bir sonuç olurdu. Bu yüzden kanca "bağlı mıyım"
 * bilgisini döndürüyor ve çağıran taraf yoklamayı yalnızca bağlı DEĞİLKEN
 * çalıştırıyor.
 */

export type CanliOlay =
  | { tip: "mesaj"; mesajId: string; gonderenId: string; icerik: string; createdAt: string }
  | { tip: "okunmamis"; sayi: number }
  | { tip: "adim-tamamlandi"; stepId: string; baslik: string };

const OLAY_TIPLERI = ["mesaj", "okunmamis", "adim-tamamlandi"] as const;

/**
 * @param onOlay her olayda çağrılır. Referansı değişse bile bağlantı YENİDEN
 *   KURULMAZ — aksi halde her render'da yeni bir SSE bağlantısı açılırdı.
 */
export function useCanliAkis(onOlay: (olay: CanliOlay) => void): { bagli: boolean } {
  const [bagli, setBagli] = useState(false);
  const olayRef = useRef(onOlay);
  olayRef.current = onOlay;

  useEffect(() => {
    // Sunucu tarafı render'da EventSource yok.
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const es = new EventSource("/api/messages/stream");

    const isle = (e: MessageEvent) => {
      try {
        olayRef.current(JSON.parse(e.data) as CanliOlay);
      } catch {
        // Bozuk bir olay akışı düşürmemeli.
      }
    };

    for (const tip of OLAY_TIPLERI) es.addEventListener(tip, isle as EventListener);

    es.onopen = () => setBagli(true);
    es.onerror = () => {
      // EventSource kendiliğinden yeniden bağlanır; biz yalnızca durumu
      // düşürüyoruz ki çağıran taraf yoklamaya geri dönsün.
      setBagli(false);
    };

    return () => {
      for (const tip of OLAY_TIPLERI) es.removeEventListener(tip, isle as EventListener);
      es.close();
      setBagli(false);
    };
  }, []);

  return { bagli };
}
