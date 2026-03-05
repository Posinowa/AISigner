"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle, Lock, ExternalLink, Loader2 } from "lucide-react";
import { StepComments } from "@/features/messaging/ui/StepComments";
import { StepFiles } from "@/features/files/ui/StepFiles";

type Step = {
  id: string;
  order: number;
  title: string;
  description: string;
  status: string;
  estimatedHours: number | null;
  resources: string[];
};

type Props = {
  steps: Step[];
  isDraft: boolean;
  currentUserId?: string;
  currentUserRole?: string;
};

export function RoadmapSteps({ steps, isDraft, currentUserId, currentUserRole }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateStepStatus(stepId: string, newStatus: "IN_PROGRESS" | "COMPLETED") {
    setUpdatingId(stepId);
    try {
      const res = await fetch(`/api/student/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Bir hata oluştu.");
        return;
      }

      // Sayfayı yenile (RSC re-render)
      startTransition(() => {
        router.refresh();
      });
    } catch {
      alert("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="relative pl-4 md:pl-0">
      {/* Dikey Çizgi (Timeline) */}
      <div className="absolute left-[1.35rem] top-2 bottom-2 w-px bg-slate-200 hidden md:block" />

      <div className="space-y-6">
        {steps.map((step, index) => {
          const isCompleted = step.status === "COMPLETED";
          const isInProgress = step.status === "IN_PROGRESS";
          const isTodo = step.status === "TODO";

          // İlk adım her zaman açık, sonraki adımlar bir önceki COMPLETED ise açık
          const previousCompleted = index === 0 || steps[index - 1].status === "COMPLETED";
          const isLocked = isTodo && !previousCompleted;
          const isActionable = isTodo && previousCompleted;

          const isUpdating = updatingId === step.id;

          return (
            <div key={step.id} className="relative flex items-start gap-4">
              {/* Status Icon / Timeline Node */}
              <div
                className={`hidden md:flex relative z-10 items-center justify-center w-11 h-11 rounded-full bg-white border-2 shrink-0 mt-1
                  ${isCompleted ? "border-emerald-500" : isInProgress ? "border-blue-600" : isActionable ? "border-amber-400" : "border-slate-200"}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : isInProgress ? (
                  <PlayCircle className="w-5 h-5 text-blue-600" />
                ) : isActionable ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                )}
              </div>

              {/* Step Card */}
              <div
                className={`flex-1 rounded-xl p-5 transition-all border
                  ${isCompleted
                    ? "bg-white border-slate-200/60"
                    : isInProgress
                      ? "bg-white border-blue-200 ring-1 ring-blue-100 shadow-sm"
                      : isActionable
                        ? "bg-white border-amber-200 shadow-sm"
                        : "bg-slate-50/50 border-slate-200 opacity-60"
                  }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-semibold tracking-wider uppercase
                      ${isCompleted ? "text-emerald-600" : isInProgress ? "text-blue-600" : isActionable ? "text-amber-600" : "text-slate-500"}`}
                  >
                    Aşama {step.order}
                  </span>

                  {/* Durum Badge */}
                  {isInProgress && (
                    <span className="flex items-center text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-1 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse mr-1.5" />
                      Şu Anki Odak
                    </span>
                  )}
                  {isCompleted && (
                    <span className="flex items-center text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      Tamamlandı
                    </span>
                  )}
                </div>

                <h5
                  className={`font-semibold text-base mb-2
                    ${isCompleted ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900"}`}
                >
                  {step.title}
                </h5>

                {/* Açıklama - kilitli olmayan adımlarda göster */}
                {!isLocked && step.description && (
                  <p className={`text-sm leading-relaxed ${isCompleted ? "text-slate-400" : "text-slate-600"}`}>
                    {step.description}
                  </p>
                )}

                {/* Tahmini süre */}
                {!isLocked && step.estimatedHours && (
                  <p className="text-xs text-slate-400 mt-2">
                    Tahmini süre: ~{step.estimatedHours} saat
                  </p>
                )}

                {/* Kilitli mesajı */}
                {isLocked && (
                  <div className="flex items-center text-sm text-slate-400 mt-2">
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    <span>Önceki aşamanın tamamlanması bekleniyor</span>
                  </div>
                )}

                {/* Kaynaklar */}
                {!isLocked && step.resources && step.resources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                    {step.resources.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Kaynak {i + 1}
                      </a>
                    ))}
                  </div>
                )}

                {/* Aksiyon Butonları */}
                {!isDraft && !isLocked && !isCompleted && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {isTodo && isActionable && (
                      <button
                        onClick={() => updateStepStatus(step.id, "IN_PROGRESS")}
                        disabled={isUpdating || isPending}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <PlayCircle className="w-4 h-4 mr-2" />
                        )}
                        {isUpdating ? "Başlatılıyor..." : "Bu Adıma Başla"}
                      </button>
                    )}
                    {isInProgress && (
                      <button
                        onClick={() => updateStepStatus(step.id, "COMPLETED")}
                        disabled={isUpdating || isPending}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        {isUpdating ? "Tamamlanıyor..." : "Adımı Tamamla"}
                      </button>
                    )}
                  </div>
                )}

                {/* Step Yorumları */}
                {!isLocked && currentUserId && currentUserRole && (
                  <StepComments
                    stepId={step.id}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                  />
                )}

                {/* Step Dosyaları */}
                {!isLocked && currentUserId && currentUserRole && (
                  <StepFiles
                    stepId={step.id}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
