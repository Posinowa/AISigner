"use client";

import { AlertCircle, Loader2 } from "lucide-react";

/** Kullanıcı listesi yüklenirken gösterilen ekran. */
export function YuklemeEkrani() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Loader2 className="animate-spin h-7 w-7 text-blue-600 mr-3" />
      <span className="text-slate-600 font-medium">
        Kullanıcılar yükleniyor...
      </span>
    </div>
  );
}

/** Kullanıcı listesi yüklenemediğinde gösterilen ekran; yeniden deneme sunar. */
export function HataEkrani({ onTekrarDene }: { onTekrarDene: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        Kullanıcılar yüklenemedi
      </h2>
      <p className="text-slate-500 text-sm mt-1 mb-5">
        Bağlantıda bir sorun oluştu. Lütfen tekrar deneyin.
      </p>
      <button
        onClick={onTekrarDene}
        className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 transition-colors"
      >
        Tekrar Dene
      </button>
    </div>
  );
}
