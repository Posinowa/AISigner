"use client";

import { useEffect, useRef } from "react";

/**
 * Modal/dialog için minimal a11y davranışı (#6):
 * - Escape tuşuyla kapatma
 * - Açılışta dialog panele odak (klavye kullanıcısı modal içinde başlar)
 *
 * Tam bir focus-trap değildir; hafif ve bağımsız bir iyileştirmedir.
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

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    // Açılışta odak panele — sayfa kaymasını tetiklemeden.
    ref.current?.focus({ preventScroll: true });

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return ref;
}
