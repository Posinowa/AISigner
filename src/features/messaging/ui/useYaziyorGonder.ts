"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * "Yazıyor..." sinyalini gönderen istemci kancası (#354).
 *
 * ⚠️ HER TUŞ VURUŞUNDA İSTEK ATILMAZ. Sinyal sunucuda TAZELIK_MS boyunca
 * geçerli; istemcinin tek yapması gereken o pencere dolmadan bir kez daha
 * haber vermek. Kısılmasaydı hızlı yazan biri saniyede 5–6 istek üretirdi —
 * kozmetik bir gösterge için mesaj göndermekten pahalı olurdu.
 */

/** İki sinyal arasındaki en kısa süre. Sunucudaki 7 sn'lik pencerenin altında. */
const KISMA_MS = 3000;

export function useYaziyorGonder(partnerId: string | null) {
  const sonGonderim = useRef(0);
  // Hangi partnere "yazıyor" dendiği: partner değişince ESKİSİNE durdurma
  // göndermeliyiz, yoksa bıraktığımız konuşmada 7 sn daha yazıyor görünürüz.
  const aktifPartner = useRef<string | null>(null);

  const gonder = useCallback(async (to: string, yaziyor: boolean) => {
    try {
      await fetch("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sekme kapanırken de gitsin diye: normal fetch iptal edilebilir.
        keepalive: true,
        body: JSON.stringify({ to, yaziyor }),
      });
    } catch {
      // Sinyal gidemezse gösterge çıkmaz; mesajlaşma etkilenmemeli.
    }
  }, []);

  /** Kullanıcı yazarken çağrılır (kısılır). */
  const yazdiginiBildir = useCallback(() => {
    if (!partnerId) return;
    const simdi = Date.now();
    if (simdi - sonGonderim.current < KISMA_MS) return;
    sonGonderim.current = simdi;
    aktifPartner.current = partnerId;
    void gonder(partnerId, true);
  }, [partnerId, gonder]);

  /** Mesaj gönderildiğinde / alan terk edildiğinde çağrılır. */
  const durdur = useCallback(() => {
    const hedef = aktifPartner.current;
    if (!hedef) return;
    aktifPartner.current = null;
    // Kısma sayacını da sıfırla: durdurduktan sonra tekrar yazmaya başlayan
    // kullanıcı 3 sn beklememeli, gösterge hemen geri gelmeli.
    sonGonderim.current = 0;
    void gonder(hedef, false);
  }, [gonder]);

  // Konuşma değiştiğinde / bileşen gittiğinde eski sinyali temizle.
  useEffect(() => {
    return () => {
      const hedef = aktifPartner.current;
      if (!hedef) return;
      aktifPartner.current = null;
      void gonder(hedef, false);
    };
  }, [partnerId, gonder]);

  return { yazdiginiBildir, durdur };
}
