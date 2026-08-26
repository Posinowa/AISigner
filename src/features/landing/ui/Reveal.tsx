"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Ekrana girince beliren sarmalayıcı.
 *
 * Gizleme yalnızca JS çalıştığında uygulanır: sınıf mount sonrası ekleniyor,
 * böylece betik çalışmazsa içerik görünür kalır (boş sayfa riski yok).
 * Bir kez açılan öğe geri kapanmaz.
 */
export function Reveal({
  children,
  delay = 0,
  as: Etiket = "div",
  className = "",
}: {
  children: ReactNode;
  /** kardeşler arası kademe (ms) */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.add("landing-reveal");
    el.style.transitionDelay = `${delay}ms`;

    const io = new IntersectionObserver(
      (girisler, gozlemci) => {
        for (const g of girisler) {
          if (!g.isIntersecting) continue;
          (g.target as HTMLElement).dataset.shown = "true";
          gozlemci.unobserve(g.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    // @ts-expect-error — dinamik etiket, ref türü etiketle birlikte değişir
    <Etiket ref={ref} className={className}>
      {children}
    </Etiket>
  );
}
