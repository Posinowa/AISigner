// #126 madde 5: Modal/dialog için paylaşılan focus-trap yardımcıları.
// useModalA11y (projects modal vb.) ve ConfirmDialog aynı mantığı kullanır.

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Container içindeki odaklanabilir elemanları döner. */
export function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Tab / Shift+Tab olayında odağı `container` içinde döngüye sokar
 * (son elemanda Tab → ilk; ilk elemanda Shift+Tab → son).
 * Tab dışındaki tuşlarda hiçbir şey yapmaz.
 */
export function handleTabKey(container: HTMLElement | null, e: KeyboardEvent): void {
  if (e.key !== "Tab" || !container) return;
  const focusable = getFocusable(container);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}
