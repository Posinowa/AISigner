"use client";

import { useEffect, useRef } from "react";
import { handleTabKey } from "./focus-trap";

/**
 * Modal/dialog için a11y davranışı (#6 / #126-5):
 * - Escape tuşuyla kapatma
 * - Açılışta dialog panele odak (klavye kullanıcısı modal içinde başlar)
 * - Tab / Shift+Tab odağını modal içinde tutar (focus-trap)
 * - Kapanışta odağı, dialog'u açan tetikleyici elemana geri verir
 *
 * Dönen ref dialog paneline bağlanmalı; panele ayrıca
 * `role="dialog" aria-modal="true" tabIndex={-1}` verilmelidir.
 *
 * onClose bir ref'te tutulur; böylece çağıran taraf inline arrow geçse bile
 * effect yalnızca `isOpen` değiştiğinde çalışır (her render'da focus çalınmaz).
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Modal'ı açan eleman — kapanışta odak buraya geri verilir.
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      handleTabKey(ref.current, e);
    };
    document.addEventListener("keydown", onKeyDown);
    // Açılışta odak panele — sayfa kaymasını tetiklemeden.
    ref.current?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Kapanışta odağı tetikleyiciye iade et (klavye kullanıcısı kaybolmasın).
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  return ref;
}
