"use client";

import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";

type Props = {
  className?: string;
};

/**
 * Okunmamış mesaj sayısını gösteren badge.
 * Herhangi bir dashboard/layout'a eklenebilir.
 */
export function UnreadBadge({ className = "" }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/messages/unread-count");
        if (res.ok) {
          const data = await res.json();
          setCount(data.unreadCount);
        }
      } catch {
        // Sessiz fail
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 15000); // 15 saniyede bir kontrol
    return () => clearInterval(interval);
  }, []);

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
