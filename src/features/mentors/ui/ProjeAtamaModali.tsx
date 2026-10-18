"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { AlertCircle, Loader2, Sparkles, Users } from "lucide-react";
import { stripMarkdown } from "@/lib/markdown-preview";
import { yukEtiketi } from "@/features/projects/yuk-etiketi";
import { ZORLUK_ETIKETI } from "@/lib/ui/proje-durumu";

export type ProjectTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
  githubRepoUrl?: string | null;
  /** #499: Şu an bu projede çalışan stajyer sayısı. */
  calisanSayisi?: number;
};

export type AIRecommendation = {
  projectId: string;
  matchScore: number;
  reason: string;
};

export type ProjeAtamaModaliProps = {
  dialogRef: RefObject<HTMLDivElement | null>;
  studentName: string;
  onKapat: () => void;
  sortedProjectTemplates: ProjectTemplate[];
  templatesLoading: boolean;
  templatesError: boolean;
  loadProjectTemplates: () => void;
  isAIThinking: boolean;
  handleAIRecommend: () => void;
  aiError: string | null;
  setAiError: Dispatch<SetStateAction<string | null>>;
  aiRecommendations: AIRecommendation[];
  assigningId: string | null;
  assignProject: (projectId: string) => void;
  getAssignedProjectIds: () => string[];
};

/** Öğrenciye proje atama modal'ı: şablon listesi, AI önerisi ve atama düğmesi. */
export function ProjeAtamaModali({
  dialogRef,
  studentName,
  onKapat,
  sortedProjectTemplates,
  templatesLoading,
  templatesError,
  loadProjectTemplates,
  isAIThinking,
  handleAIRecommend,
  aiError,
  setAiError,
  aiRecommendations,
  assigningId,
  assignProject,
  getAssignedProjectIds,
}: ProjeAtamaModaliProps) {
  return (
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-label="Proje Ata"
    tabIndex={-1}
    className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col outline-none"
  >

    <div className="flex justify-between items-center p-6 border-b bg-gray-50/80">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Proje Ata - {studentName}</h2>
        <p className="text-sm text-gray-500 mt-1">Öğrencinin profiline en uygun projeyi seçin.</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleAIRecommend}
          disabled={isAIThinking || templatesLoading}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm ${
            isAIThinking || templatesLoading
              ? "bg-[#3e92cc]/15 text-[#3e92cc] cursor-wait"
              : "bg-gradient-to-r from-[#3e92cc] to-primary hover:from-[#2f7cb0] hover:to-[#1b2a55] text-primary-foreground shadow-[#3e92cc]/30"
          }`}
        >
          {isAIThinking || templatesLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isAIThinking ? "AI Analiz Ediyor..." : templatesLoading ? "Yükleniyor..." : "🤖 AI Öner"}
        </button>

        <button
          onClick={() => onKapat()}
          aria-label="Kapat"
          className="text-gray-400 hover:text-gray-900 p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          ×
        </button>
      </div>
    </div>

    <div className="p-6 overflow-y-auto">
      {aiError && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">AI Önerisi Başarısız</p>
            <p className="mt-0.5 text-red-600">{aiError}</p>
          </div>
          <button onClick={() => setAiError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}
      {templatesError ? (
        /* #159: Şablon isteği patladığında "şablon yok" denmesin. */
        <div className="text-center py-12">
          <AlertCircle className="w-7 h-7 text-red-500 mx-auto mb-3" />
          <p className="text-slate-900 font-semibold">Proje şablonları yüklenemedi</p>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Bağlantıda bir sorun oluştu.
          </p>
          <button
            onClick={loadProjectTemplates}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      ) : sortedProjectTemplates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Proje şablonu bulunamadı</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedProjectTemplates.map(template => {
            const isAssigned = getAssignedProjectIds().includes(template.id);
            const difficultyInfo = ZORLUK_ETIKETI[template.difficulty];
            const isLoadingThis = assigningId === template.id;
            const aiRec = aiRecommendations.find(r => r.projectId === template.id);

            return (
              <div 
                key={template.id} 
                className={`flex flex-col border rounded-2xl overflow-hidden transition-all duration-300 ${
                  isAssigned ? 'bg-gray-50 border-gray-200 opacity-60' : 
                  aiRec ? 'border-[#3e92cc] shadow-lg shadow-[#3e92cc]/20 bg-[#3e92cc]/5 scale-[1.02]' : 
                  'hover:shadow-lg border-gray-200 bg-white hover:-translate-y-1'
                }`}
              >
                {aiRec && !isAssigned && (
                  <div className="bg-gradient-to-r from-[#3e92cc]/15 to-[#3e92cc]/5 border-b border-[#3e92cc]/20 p-3.5">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="flex items-center text-[11px] font-bold text-primary uppercase tracking-wider">
                        <Sparkles className="w-3 h-3 mr-1" /> En İyi Eşleşme
                      </span>
                      <span className="text-[10px] font-bold text-primary-foreground bg-[#3e92cc] px-2 py-0.5 rounded-full shadow-sm">
                        %{aiRec.matchScore} Uyum
                      </span>
                    </div>
                    <p className="text-xs text-[#2f7cb0]/90 font-medium leading-relaxed">
                      {`"${aiRec.reason}"`}
                    </p>
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <h3 className="font-bold text-gray-900 leading-snug">{template.title}</h3>
                    <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg ${difficultyInfo.color} shrink-0`}>
                      {difficultyInfo.label}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">
                    {stripMarkdown(template.description)}
                  </p>
                  
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {template.track.slice(0, 3).map((tag, index) => (
                      <span key={index} className="px-2 py-1 text-[11px] font-semibold bg-gray-100 text-gray-600 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* #499: Bu projede şu an kaç stajyer çalışıyor.
                      ⚠️ ATAMAYI ENGELLEMİYOR — aynı projeyi birden çok
                      stajyerin yapması meşru (farklı dönem, farklı
                      seviye). Sayı yalnız kararı bilgilendiriyor;
                      #404'te mentör kapasitesi için verilen kararın
                      aynısı. */}
                  <div className="mb-5 flex items-center gap-1.5 text-[11px] font-medium">
                    <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span
                      className={
                        (template.calisanSayisi ?? 0) === 0
                          ? "text-emerald-700"
                          : "text-slate-500"
                      }
                    >
                      {yukEtiketi(template.calisanSayisi ?? 0)}
                    </span>
                  </div>
                  
                  <button
                   onClick={() => assignProject(template.id)}
                   disabled={isAssigned || assigningId !== null}
                   className={`w-full py-3 px-4 rounded-xl font-bold transition-all duration-200 ${
                     isAssigned 
                       ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                       : aiRec 
                         ? 'bg-primary hover:bg-[#1b2a55] text-primary-foreground shadow-md hover:shadow-lg' 
                         : 'bg-gray-900 hover:bg-black text-white shadow-md'
                   }`}
                  >
                    {isAssigned ? 'Zaten Atanmış' : (isLoadingThis ? 'Atanıyor...' : 'Projeyi Ata')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
</div>
  );
}
