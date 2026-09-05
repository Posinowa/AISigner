"use client";

import {
  Users,
  Clock,
  CheckCircle2,
  GraduationCap,
  UserCog,
  ShieldCheck,
} from "lucide-react";
import type { KullaniciSayilari, PanelKategorisi } from "@/features/admin/kategoriler";

/**
 * Admin panelinin üst istatistik kartları (#489).
 *
 * ⚠️ KARTLAR AYNI ZAMANDA FİLTRE: her biri tıklanınca ilgili kategoriye
 * geçiyor ve aktif olan halkayla işaretleniyor. Bu yüzden salt gösterim
 * değil — `aktifKategori` ve `onKategori` almak zorunda.
 *
 * ⚠️ SAYILAR SUNUCUDAN GELİR (#452/#448), listeden sayılmaz. Sayfalanan bir
 * listede istemcide sayılan sayaç "yüklenmiş kadarını" gösterir ve panelin
 * verdiği rakam sessizce yanlış olur. Bu bileşen sayıyı yalnız BASAR.
 */
export function IstatistikKartlari({
  sayilar,
  aktifKategori,
  onKategori,
}: {
  sayilar: KullaniciSayilari;
  aktifKategori: PanelKategorisi;
  onKategori: (kategori: PanelKategorisi) => void;
}) {
  const kartlar = [
    {
      icon: Users,
      color: "text-blue-600 bg-blue-50",
      label: "Toplam Kullanıcı",
      value: sayilar.total,
      filter: "ALL" as PanelKategorisi,
    },
    {
      icon: Clock,
      color: "text-amber-600 bg-amber-50",
      label: "Onay Bekleyen",
      value: sayilar.pendingCount,
      filter: "PENDING" as PanelKategorisi,
    },
    {
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50",
      label: "Aktif Stajyer",
      value: sayilar.activeStudents,
      filter: "APPROVED" as PanelKategorisi,
    },
    {
      icon: GraduationCap,
      color: "text-primary bg-primary/10",
      label: "Mezun / Biten",
      value: sayilar.graduatedCount,
      filter: "GRADUATED" as PanelKategorisi,
    },
    {
      icon: UserCog,
      color: "text-indigo-600 bg-indigo-50",
      label: "Mentör",
      value: sayilar.mentorCount,
      filter: "MENTOR" as PanelKategorisi,
    },
    {
      icon: ShieldCheck,
      color: "text-rose-600 bg-rose-50",
      label: "Yönetici",
      value: sayilar.adminCount,
      filter: "ADMIN" as PanelKategorisi,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-8">
      {kartlar.map(({ icon: Icon, color, label, value, filter }) => (
        <button
          key={label}
          onClick={() => onKategori(filter)}
          className={`text-left rounded-2xl border p-4 shadow-sm transition-all ${
            aktifKategori === filter
              ? "bg-white ring-2 ring-ring border-blue-500 shadow-md"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} mb-2.5 shrink-0`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <p className="text-xs font-medium text-slate-500 truncate leading-tight">
            {label}
          </p>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">
            {value}
          </p>
        </button>
      ))}
    </div>
  );
}
