"use client";

import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import type { StudentAssignmentProgress } from "@/features/admin/ui/atama-tipleri";

export type GithubOnizlemeModaliProps = {
  selectedAssignment: StudentAssignmentProgress;
  isProvisioning: boolean;
  onKapat: () => void;
  onOnayla: () => void;
};

/** GitHub çalışma alanı oluşturma önizleme modal'ı (onaydan önce). */
export function GithubOnizlemeModali({ selectedAssignment, isProvisioning, onKapat, onOnayla }: GithubOnizlemeModaliProps) {
  return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
  <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        GitHub Çalışma Alanı Oluştur
      </h3>
      <button
        onClick={() => onKapat()}
        className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
      >
        Kapat
      </button>
    </div>

    <div className="space-y-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
      <div>
        <span className="font-semibold text-slate-900">Hedef Organizasyon:</span>{" "}
        <span className="text-indigo-600 font-bold">Posinowa</span> (github.com/Posinowa)
      </div>
      <div>
        <span className="font-semibold text-slate-900">Hedef Repo:</span>{" "}
        <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">
          Posinowa/aisigner-{(selectedAssignment.studentName || "student").toLowerCase().replace(/[^a-z0-9]/g, "")}-{(selectedAssignment.projectTitle || "project").toLowerCase().replace(/[^a-z0-9]/g, "-")}
        </code>
      </div>
      <div>
        <span className="font-semibold text-slate-900">Öğrenci:</span>{" "}
        {selectedAssignment.studentName} ({selectedAssignment.experienceLevel})
      </div>
      <div>
        <span className="font-semibold text-slate-900">Proje:</span>{" "}
        {selectedAssignment.projectTitle}
      </div>
      <div>
        <span className="font-semibold text-slate-900">Oluşturulacak Faz Sayısı (Milestone):</span>{" "}
        {selectedAssignment.totalSteps} Faz
      </div>
      <div>
        <span className="font-semibold text-slate-900">Tahmini Açılacak Issue Sayısı:</span>{" "}
        ~{selectedAssignment.totalSteps * 3} AI Detaylı Issue
      </div>
    </div>

    <p className="text-xs text-slate-500">
      Bu akış, <strong className="text-slate-700">Posinowa</strong> organizasyonu için öğrenciye özel repo, faz (Milestone) ve AI ile detaylandırılmış görev (Issue) yapısını hazırlar.
    </p>

    {/* #178-1: Bu özellik şu an ÖNİZLEME/simülasyondur — dürüstçe belirtilir. */}
    <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        <strong>Önizleme:</strong> Bu işlem şu an bir <strong>simülasyondur</strong>. AI görev
        içerikleri gerçekten üretilip kaydedilir, ancak GitHub&apos;da fiziksel bir repo/issue
        <strong> oluşturulmaz</strong> — üretilen linkler yer tutucudur. Gerçek GitHub entegrasyonu ayrı olarak planlanmaktadır.
      </span>
    </div>

    <div className="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={() => onKapat()}
        disabled={isProvisioning}
        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
      >
        İptal
      </button>
      <button
        type="button"
        onClick={onOnayla}
        disabled={isProvisioning}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition disabled:opacity-50"
      >
        {isProvisioning ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Oluşturuluyor...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            Onayla ve GitHub&apos;da Başlat
          </>
        )}
      </button>
    </div>
  </div>
</div>
  );
}
