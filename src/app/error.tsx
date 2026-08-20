"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Global hata sınırı (error boundary).
 * Bir sayfa/segment beklenmeyen bir hata fırlatırsa kullanıcıya çökmüş ham
 * sayfa yerine bu dostça ekran gösterilir. `reset()` segment'i yeniden dener.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uygulama hatası:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl ring-1 ring-slate-200/60 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-orange-500" />
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Bir şeyler ters gitti</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Beklenmeyen bir hata oluştu. Tekrar deneyebilir veya birazdan yeniden
            ziyaret edebilirsiniz.
          </p>
          <button
            onClick={reset}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 font-semibold text-white shadow-md shadow-primary transition-all focus:outline-none focus:ring-3 focus:ring-ring"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    </div>
  );
}
