"use client";

import { X } from "lucide-react";

/**
 * Adım kaynaklarının düzenleme listesi (#494).
 *
 * ⚠️ BU JSX İKİ YERDE KARAKTERİ KARAKTERİNE AYNIYDI — adım düzenleme formu
 * ve yeni adım formu. Aynı `className` zincirleri, aynı `placeholder`, aynı
 * ikon; yalnız değişken ve işleyici adları farklıydı. İkisi de artık buradan
 * geçiyor, yani biri güncellenip diğeri unutulamaz.
 *
 * Mantık `features/roadmap/kaynaklar.ts`'te (saf fonksiyonlar); bu bileşen
 * yalnız çiziyor.
 */
export function KaynakListesi({
  kaynaklar,
  onGuncelle,
  onKaldir,
  onEkle,
}: {
  kaynaklar: string[];
  onGuncelle: (index: number, deger: string) => void;
  onKaldir: (index: number) => void;
  onEkle: () => void;
}) {
  return (
    <div className="space-y-2">
      {kaynaklar.map((res, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={res}
            onChange={(e) => onGuncelle(i, e.target.value)}
            placeholder="https://... veya kaynak adı"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none"
          />
          <button
            onClick={() => onKaldir(i)}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={onEkle}
        className="text-xs text-primary hover:text-[#3e92cc] font-medium"
      >
        + Kaynak Ekle
      </button>
    </div>
  );
}
