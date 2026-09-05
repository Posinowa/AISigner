"use client";

import { Search } from "lucide-react";
import type { KullaniciSayilari, PanelKategorisi } from "@/features/admin/kategoriler";

/**
 * Admin panelinin arama kutusu ve kategori sekmeleri (#489).
 *
 * ⚠️ ARAMA VE SÜZME SUNUCUDA (#448). Bu bileşen yalnız girdiyi topluyor;
 * hiçbir liste süzmüyor. Naif bir istemci süzgeci, sayfalanan listede yalnız
 * YÜKLÜ sayfayı tarar ve admin var olan bir kaydı arayıp "sonuç yok"
 * görürdü — #448'in en sinsi yan etkisi olarak yazılı.
 *
 * ⚠️ İki sekmenin etiketinde SAYI var (mentör başvuruları, doğrulanmamış):
 * ikisi de admin'in gözünden kaçmaması gereken kuyruklar. Sayılar sunucudan
 * gelen sayaçlardan; listeden hesaplanmıyor.
 */
export function AramaVeKategoriler({
  arama,
  onArama,
  sayilar,
  aktifKategori,
  onKategori,
}: {
  arama: string;
  onArama: (deger: string) => void;
  sayilar: KullaniciSayilari;
  aktifKategori: PanelKategorisi;
  onKategori: (kategori: PanelKategorisi) => void;
}) {
  const sekmeler: { id: PanelKategorisi; label: string }[] = [
    { id: "ALL", label: "Tümü" },
    { id: "PENDING", label: "Onay Bekleyenler" },
    { id: "APPROVED", label: "Aktif Stajyerler" },
    { id: "GRADUATED", label: "Mezunlar 🎓" },
    { id: "REJECTED", label: "Reddedilenler" },
    { id: "MENTOR", label: "Mentörler" },
    {
      id: "MENTOR_BASVURU",
      label: `Mentör Başvuruları${sayilar.mentorBasvuruCount > 0 ? ` (${sayilar.mentorBasvuruCount})` : ""}`,
    },
    {
      id: "DOGRULANMAMIS",
      label: `Doğrulanmamış${sayilar.dogrulanmamisCount > 0 ? ` (${sayilar.dogrulanmamisCount})` : ""}`,
    },
    { id: "ADMIN", label: "Yöneticiler" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center justify-between">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={arama}
          onChange={(e) => onArama(e.target.value)}
          placeholder="İsim veya e-posta ile ara..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-ring outline-none transition"
        />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {sekmeler.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onKategori(id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              aktifKategori === id
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
