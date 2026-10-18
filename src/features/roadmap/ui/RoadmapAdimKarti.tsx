"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Session } from "next-auth";
import { ArrowDown, ArrowUp, BookOpen, CheckCircle, ChevronDown, ChevronUp, Clock, ExternalLink, Github, Loader2, MessageSquare, Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import { RevizyonIste } from "@/features/roadmap/ui/RevizyonIste";
import { StepComments } from "@/features/messaging/ui/StepComments";
import { StepFiles } from "@/features/files/ui/StepFiles";
import { KaynakListesi } from "@/features/roadmap/ui/KaynakListesi";
import type { YeniAdimForm, YeniAdimFormuProps } from "@/features/roadmap/ui/YeniAdimFormu";

export type RoadmapStep = {
  id: string;
  order: number;
  /** #407: Bu adımdaki yorum sayısı (toplam — okunma izi şemada yok). */
  _count?: { comments: number };
  title: string;
  description: string;
  estimatedHours: number | null;
  resources: string[];
  status: string;
  githubIssueUrl?: string | null;
};

const stepStatusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  TODO: { label: "Yapılacak", color: "bg-gray-100 text-gray-700", icon: Clock },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-700", icon: BookOpen },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-100 text-green-700", icon: CheckCircle },
  // #379: Mentör "eksik, revize et" dedi. Ayrı bir renk: panoda hiç
  // çalışılmamış adımdan ayırt edilebilmeli.
  REVISION_REQUESTED: {
    label: "Revizyon istendi",
    color: "bg-amber-100 text-amber-800",
    icon: RotateCcw,
  },
};

export type RoadmapAdimKartiProps = {
  step: RoadmapStep;
  index: number;
  toplamAdim: number;
  isExpanded: boolean;
  isEditing: boolean;
  tasinan: string | null;
  editForm: YeniAdimForm;
  setEditForm: Dispatch<SetStateAction<YeniAdimForm>>;
  editKaynak: YeniAdimFormuProps["yeniKaynak"];
  saving: boolean;
  kullanici: Session["user"] | undefined;
  setExpandedStepId: Dispatch<SetStateAction<string | null>>;
  handleTasi: (stepId: string, yon: "yukari" | "asagi") => void;
  startEditStep: (step: RoadmapStep) => void;
  cancelEditStep: () => void;
  handleSaveStep: () => void;
  handleDeleteStep: (stepId: string) => void;
  loadRoadmap: () => void;
};

/** Yol haritasında tek adımın kartı: sıra, akordeon, düzenleme, yorum ve dosyalar. */
export function RoadmapAdimKarti({
  step,
  index,
  toplamAdim,
  isExpanded,
  isEditing,
  tasinan,
  editForm,
  setEditForm,
  editKaynak,
  saving,
  kullanici,
  setExpandedStepId,
  handleTasi,
  startEditStep,
  cancelEditStep,
  handleSaveStep,
  handleDeleteStep,
  loadRoadmap,
}: RoadmapAdimKartiProps) {
  const statusInfo = stepStatusConfig[step.status] || stepStatusConfig.TODO;
  const StatusIcon = statusInfo.icon;

  return (
  <div
    key={step.id}
    className={`border rounded-xl overflow-hidden transition-all ${
      isEditing
        ? "border-[#3e92cc] shadow-lg ring-2 ring-primary/10"
        : "bg-white hover:shadow-md"
    }`}
  >
    {/* Adım Başlığı */}
    <div
      className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
      onClick={() => {
        if (!isEditing) {
          setExpandedStepId(isExpanded ? null : step.id);
        }
      }}
    >
      {/* #406: Sıra değiştirme. Kartın tamamı akordeonu açıp kapattığı
          için düğmeler stopPropagation yapmak zorunda — aksi halde
          taşıma her seferinde adımı da açardı. */}
      <div
        className="flex flex-col flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => handleTasi(step.id, "yukari")}
          disabled={index === 0 || tasinan !== null}
          aria-label={`${step.title} adımını yukarı taşı`}
          className="p-0.5 text-gray-400 hover:text-primary disabled:opacity-25 disabled:hover:text-gray-400"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleTasi(step.id, "asagi")}
          disabled={index === toplamAdim - 1 || tasinan !== null}
          aria-label={`${step.title} adımını aşağı taşı`}
          className="p-0.5 text-gray-400 hover:text-primary disabled:opacity-25 disabled:hover:text-gray-400"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex-shrink-0">
        {tasinan === step.id ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          index + 1
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{step.title}</h3>
        {!isExpanded && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{step.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {step.estimatedHours && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {step.estimatedHours}s
          </span>
        )}
        {/* #407: Stajyer yorum yazdığında mentör de fark etmiyordu —
            yorumlar akordeonun içindeydi. Sıfırsa basılmıyor. */}
        {(step._count?.comments ?? 0) > 0 && (
          <span
            title={`${step._count?.comments} yorum`}
            className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600"
          >
            <MessageSquare className="w-3 h-3" />
            {step._count?.comments}
          </span>
        )}
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${statusInfo.color}`}>
          <StatusIcon className="w-3 h-3 inline mr-0.5" />
          {statusInfo.label}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>
    </div>

    {/* Açılır İçerik */}
    {isExpanded && (
      <div className="border-t px-5 pb-5 pt-4 bg-gray-50/50">
        {isEditing ? (
          /* ─── Düzenleme Modu ─── */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tahmini Süre (saat)</label>
              <input
                type="number"
                min={0}
                value={editForm.estimatedHours}
                onChange={(e) =>
                  setEditForm({ ...editForm, estimatedHours: parseInt(e.target.value) || 0 })
                }
                className="w-32 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Issue Linki (opsiyonel)</label>
              <input
                type="text"
                value={editForm.githubIssueUrl}
                onChange={(e) => setEditForm({ ...editForm, githubIssueUrl: e.target.value })}
                placeholder="https://github.com/kullanici/repo/issues/12"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kaynaklar</label>
              <KaynakListesi
                kaynaklar={editForm.resources}
                onGuncelle={editKaynak.guncelle}
                onKaldir={editKaynak.kaldir}
                onEkle={editKaynak.ekle}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSaveStep}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-[#1b2a55] text-primary-foreground text-sm font-medium rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button
                onClick={cancelEditStep}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                İptal
              </button>
            </div>
          </div>
        ) : (
          /* ─── Görüntüleme Modu ─── */
          <div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {step.description}
            </p>

            {/* #379: Mentör onay kapısı. Yalnız TAMAMLANMIŞ adımda
                görünür — bileşen kendi içinde karar veriyor. */}
            <div className="mt-4">
              <RevizyonIste
                stepId={step.id}
                stepStatus={step.status}
                onTamamlandi={loadRoadmap}
              />
            </div>

            {step.resources.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Kaynaklar
                </h4>
                <div className="flex flex-wrap gap-2">
                  {step.resources.map((resource, i) => (
                    <a
                      key={i}
                      href={resource.startsWith("http") ? resource : `https://www.google.com/search?q=${encodeURIComponent(resource)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {resource.length > 50 ? resource.substring(0, 50) + "..." : resource}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {step.estimatedHours && (
              <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Tahmini: {step.estimatedHours} saat
              </div>
            )}

            {step.githubIssueUrl && (
              <a
                href={step.githubIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                {step.githubIssueUrl.replace(/^https:\/\/github\.com\//, "")}
              </a>
            )}

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => startEditStep(step)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Düzenle
              </button>
              <button
                onClick={() => handleDeleteStep(step.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Sil
              </button>
            </div>

            {/* Adım Yorumları */}
            {kullanici?.id && (
              <StepComments
                stepId={step.id}
                currentUserId={kullanici.id}
                currentUserRole={kullanici.role || "MENTOR"}
              />
            )}

            {/* Adım Dosyaları */}
            {kullanici?.id && (
              <StepFiles
                stepId={step.id}
                currentUserId={kullanici.id}
                currentUserRole={kullanici.role || "MENTOR"}
              />
            )}
          </div>
        )}
      </div>
    )}
  </div>
  );
}
