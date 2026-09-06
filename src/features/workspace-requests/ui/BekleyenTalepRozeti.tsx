"use client";

import { useState, useEffect } from "react";

/**
 * Bekleyen çalışma alanı talebi sayısı (#349).
 *
 * NEDEN VAR: Talep kaydı darboğazı kaldırmıyor, GÖRÜNÜR kılıyor. Kuyruk fark
 * edilmezse darboğaz yalnızca yer değiştirmiş olur — mentör admin'e mesaj
 * atmak yerine görülmeyen bir kuyrukta bekler. Rozet bu özelliğin işe
 * yaramasının ön koşulu.
 *
 * Polling deseni `UnreadBadge` ile aynı: sekme arka plandayken istek atılmaz,
 * öne gelince beklemeden tazelenir. Talepler mesajlardan seyrek olduğu için
 * aralık daha uzun.
 */

const ARALIK_MS = 60_000;

export function BekleyenTalepRozeti() {
  const [sayi, setSayi] = useState(0);

  useEffect(() => {
    async function getir() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/admin/workspace-requests");
        if (res.ok) {
          const veri = await res.json();
          setSayi(Array.isArray(veri.talepler) ? veri.talepler.length : 0);
        }
      } catch {
        // Sessiz fail: rozet gösterilemezse sayfa çalışmaya devam etmeli.
      }
    }

    getir();
    const zamanlayici = setInterval(getir, ARALIK_MS);

    const gorunurOldu = () => {
      if (document.visibilityState === "visible") getir();
    };
    document.addEventListener("visibilitychange", gorunurOldu);

    return () => {
      clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", gorunurOldu);
    };
  }, []);

  if (sayi === 0) return null;

  return (
    <span
      // Sayı ekran okuyucuda anlamsız kalmasın.
      aria-label={`${sayi} bekleyen çalışma alanı talebi`}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white"
    >
      {sayi > 9 ? "9+" : sayi}
    </span>
  );
}
