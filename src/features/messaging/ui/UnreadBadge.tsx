"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { useCanliAkis } from "./useCanliAkis";

type Props = {
  className?: string;
};

/**
 * Okunmamış mesaj sayısını gösteren badge.
 * Herhangi bir dashboard/layout'a eklenebilir.
 */
export function UnreadBadge({ className = "" }: Props) {
  const [count, setCount] = useState(0);

  /**
   * Akıştan bir değer geldi mi?
   *
   * ⚠️ YARIŞ KORUMASI: açılıştaki ilk `fetch` uçuştayken akış daha taze bir
   * sayı gönderebiliyor. Koruma olmadan geciken yanıt üzerine yazıyor ve rozet
   * eski değere geri dönüyordu — testte yakalandı.
   */
  const akistanGeldi = useRef(false);

  // #329: Sayacı canlı akış besliyor. Akış her tikte "değiştiyse" yolluyor,
  // yani okundu işaretlemesi de anında yansıyor.
  const { bagli } = useCanliAkis(
    useCallback((olay) => {
      if (olay.tip !== "okunmamis") return;
      akistanGeldi.current = true;
      setCount(olay.sayi);
    }, []),
  );

  const fetchCount = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const res = await fetch("/api/messages/unread-count");
      if (res.ok) {
        const data = await res.json();
        // Akış zaten konuştuysa yanıt bayattır.
        if (!akistanGeldi.current) setCount(data.unreadCount);
      }
    } catch {
      // Sessiz fail
    }
  }, []);

  // İlk değer: akış ilk tikini beklemeden rozet doğru görünsün.
  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // #329: YOKLAMA YEDEĞİ. Akış bağlıyken çalışmaz; koptuğunda devreye girer.
  // Kaldırılsaydı, SSE'yi kesen bir vekilin arkasında rozet ölü kalırdı.
  useEffect(() => {
    if (bagli) return;

    // Akış koptu: yoklama yeniden tek doğru kaynak olur.
    akistanGeldi.current = false;

    const interval = setInterval(fetchCount, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [bagli, fetchCount]);

  return (
    <span className={`relative inline-flex ${className}`}>
      <MessageCircle className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}
