// #92: Native confirm() yerine tasarım diliyle uyumlu, söz-tabanlı (promise) onay dialogu.
//
// Kullanım:
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "...", description: "...", danger: true }))) return;
//
// Root layout'ta bir kez <ConfirmDialogProvider> sarmalanır; tek bir dialog örneği
// uygulama genelinde paylaşılır. Escape / backdrop / İptal → false, Onayla → true.
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { handleTabKey } from "./focus-trap";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true → onay butonu kırmızı (silme gibi geri alınamaz aksiyonlar). */
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm, <ConfirmDialogProvider> içinde kullanılmalıdır.");
  }
  return ctx;
}

type PendingState = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Dialog'u açan eleman — kapanışta odak buraya geri verilir.
  const triggerRef = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      setPending((current) => {
        current?.resolve(result);
        return null;
      });
    },
    [],
  );

  // Açılışta odak + Escape ile iptal + Tab-trap + kapanışta odak iadesi.
  useEffect(() => {
    if (!pending) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // #126-5: Tehlikeli (danger) onaylarda varsayılan odak İptal'de (güvenli varsayılan);
    // aksi halde onay butonunda.
    const initial = pending.options.danger ? cancelBtnRef.current : confirmBtnRef.current;
    initial?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      handleTabKey(dialogRef.current, e);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => close(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-3">
                {pending.options.danger && (
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">
                    {pending.options.title}
                  </h2>
                  {pending.options.description && (
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {pending.options.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => close(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                {pending.options.cancelLabel ?? "İptal"}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(true)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${
                  pending.options.danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {pending.options.confirmLabel ?? "Onayla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
