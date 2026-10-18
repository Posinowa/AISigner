"use client";

import type { RefObject } from "react";
import { X } from "lucide-react";
import { ProfileAnalysisCard, type ProfileAnalysisData } from "@/features/ai/ui/ProfileAnalysisCard";
import { getDisplayName, type User } from "@/features/admin/ui/kullanici-sabitleri";

export type AnalizModaliProps = {
  kullanici: User;
  dialogRef: RefObject<HTMLDivElement | null>;
  analysis: ProfileAnalysisData | null;
  loading: boolean;
  error: string | null;
  onKapat: () => void;
};

/** Admin — öğrencinin AI profil analizi modal'ı (veri üst bileşende çekilir). */
export function AnalizModali({
  kullanici,
  dialogRef,
  analysis,
  loading,
  error,
  onKapat,
}: AnalizModaliProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI Profil Analizi"
        tabIndex={-1}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto outline-none border border-slate-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              AI Profil Analizi
            </h2>
            <p className="text-xs text-slate-500">
              {getDisplayName(kullanici)} ({kullanici.email})
            </p>
          </div>
          <button
            onClick={onKapat}
            aria-label="Kapat"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <ProfileAnalysisCard
            analysis={analysis}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
