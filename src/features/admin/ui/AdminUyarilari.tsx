"use client";

import { AlertCircle, Clock, UserCog } from "lucide-react";
import type { KullaniciSayilari, PanelKategorisi } from "@/features/admin/kategoriler";

/** #250: Bekleyen mentör başvurusu varsa panelin en üstünde gösterilen şerit. */
export function MentorBasvuruUyarisi({
  stats,
  setFilterCategory,
}: {
  stats: KullaniciSayilari;
  setFilterCategory: (kategori: PanelKategorisi) => void;
}) {
  return (
    <>
  {/* #250: Mentör başvurusu bekliyorsa admin bunu panele girer girmez
      görmeli; başvuru listedeki satırlardan birine gömülü kalmasın. */}
  {stats.mentorBasvuruCount > 0 && (
    <button
      onClick={() => setFilterCategory("MENTOR_BASVURU")}
      className="mb-6 w-full flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left transition hover:border-amber-300"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <UserCog className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-amber-900">
          {stats.mentorBasvuruCount} mentör başvurusu onay bekliyor
        </span>
        <span className="block text-xs text-amber-700">
          Başvuruları görmek için tıklayın.
        </span>
      </span>
    </button>
  )}
    </>
  );
}

/** Onay bekleyen stajyer ve mentörsüz öğrenci uyarıları. */
export function AdminBildirimleri({
  stats,
  filterCategory,
}: {
  stats: KullaniciSayilari;
  filterCategory: PanelKategorisi;
}) {
  return (
    <>
  {/* Onay bekleyen stajyerler bildirim kartı */}
  {stats.pendingCount > 0 && filterCategory === "ALL" && (
    <div className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-50/90 border border-amber-200 px-5 py-4">
      <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold text-amber-950">
          {stats.pendingCount} stajyer onay bekliyor
        </p>
        <p className="text-amber-800 mt-0.5">
          Aşağıdaki listeden bekleyen öğrencileri onaylayabilir veya profil analizlerini inceleyerek mentör atayabilirsiniz.
        </p>
      </div>
    </div>
  )}

  {/* Uyarı banner — mentor atanmamış aktif öğrenciler */}
  {stats.studentsWithoutMentor > 0 && filterCategory === "ALL" && (
    <div className="mb-6 flex items-start gap-3 rounded-2xl bg-blue-50/90 border border-blue-200 px-5 py-4">
      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold text-blue-950">
          {stats.studentsWithoutMentor} aktif öğrencinin mentoru seçilmedi
        </p>
        <p className="text-blue-800 mt-0.5">
          Onaylanmış stajyerlerinize ilgili alandaki mentörlerini aşağıdaki listeden doğrudan atayabilirsiniz.
        </p>
      </div>
    </div>
  )}
    </>
  );
}
