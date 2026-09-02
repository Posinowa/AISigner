"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle, Lock, ExternalLink, Loader2, Github } from "lucide-react";
import { StepComments } from "@/features/messaging/ui/StepComments";
import { StepFiles } from "@/features/files/ui/StepFiles";
import { toast } from "sonner";

type Step = {
  id: string;
  order: number;
  title: string;
  description: string;
  status: string;
  estimatedHours: number | null;
  resources: string[];
  githubIssueUrl?: string | null;
  // #332/#367: Adımı üstlenen takım üyesi. Bireysel atamada hep null.
  assigneeId?: string | null;
  assignee?: { id: string; name: string | null; lastName: string | null; email: string } | null;
};

/** #367: Takım üyeleri — üstlenme göstergesi ve devralma için. */
export type TakimUyesi = {
  userId: string;
  ad: string;
  role: string;
};

type Props = {
  steps: Step[];
  isDraft: boolean;
  isGraduated?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
  /** #367: Doluysa bu bir TAKIM panosudur; üstlenme arayüzü açılır. */
  takimUyeleri?: TakimUyesi[];
};

export function RoadmapSteps({
  steps,
  isDraft,
  isGraduated = false,
  currentUserId,
  currentUserRole,
  takimUyeleri,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [ustlenenId, setUstlenenId] = useState<string | null>(null);

  const takimPanosu = (takimUyeleri?.length ?? 0) > 0;

  /**
   * Adımı üstlen / bırak (#332).
   *
   * Adım TAKIMIN; bu yalnızca "kim çekti" bilgisi. BAŞKASININ üstlendiği adım
   * da devralınabiliyor — sprint panosunda iş havuzda durur ve biri çeker;
   * kilitlemek o modeli bozardı.
   */
  async function ustlen(stepId: string, assigneeId: string | null) {
    if (isGraduated) {
      toast.info("Mezuniyet sonrası staj adımları salt-okunur durumdadır.");
      return;
    }
    setUstlenenId(stepId);
    try {
      const res = await fetch(`/api/steps/${stepId}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(typeof err.error === "string" ? err.error : "Adım güncellenemedi.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setUstlenenId(null);
    }
  }

  async function updateStepStatus(stepId: string, newStatus: "IN_PROGRESS" | "COMPLETED") {
    if (isGraduated) {
      toast.info("Mezuniyet sonrası staj adımları salt-okunur durumdadır.");
      return;
    }
    setUpdatingId(stepId);
    try {
      const res = await fetch(`/api/student/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Bir hata oluştu.");
        return;
      }

      // Sayfayı yenile (RSC re-render)
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
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

                  {/* #367: Kim üstlendi + devral/bırak. Yalnız TAKIM panosunda
                      görünür; bireysel atamada tek kişi var, "üstlenme"nin
                      anlamı yok. */}
                  {takimPanosu && !isCompleted && (
                    <UstlenmeSeridi
                      step={step}
                      currentUserId={currentUserId}
                      takimUyeleri={takimUyeleri!}
                      calisiyor={ustlenenId === step.id}
                      devre={isDraft || isGraduated}
                      onUstlen={(assigneeId) => ustlen(step.id, assigneeId)}
                    />
                  )}

                  {/* Durum Badge */}
                  {isInProgress && (
                    <span className="flex items-center text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-1 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-1.5" />
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
                  <p className={`text-sm leading-relaxed ${isCompleted ? "text-slate-400 " : "text-slate-600 "}`}>
                    {step.description}
                  </p>
                )}

                {/* Tahmini süre */}
                {!isLocked && step.estimatedHours && (
                  <p className="text-xs text-slate-400 mt-2">
                    Tahmini süre: ~{step.estimatedHours} saat
                  </p>
                )}

                {/* GitHub Issue Linki */}
                {!isLocked && step.githubIssueUrl && (
                  <a
                    href={step.githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors mt-2"
                  >
                    <Github className="w-3.5 h-3.5 mr-1.5" />
                    GitHub Issue&apos;yu Görüntüle
                  </a>
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

                {/* Aksiyon Butonları — Mezun olmayan ve yayınlanmış adımlarda aktif */}
                {!isGraduated && !isDraft && !isLocked && !isCompleted && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {isTodo && isActionable && (
                      <button
                        onClick={() => updateStepStatus(step.id, "IN_PROGRESS")}
                        disabled={isUpdating || isPending}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
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
                    isDraft={isDraft}
                    readOnly={isGraduated}
                  />
                )}

                {/* Step Dosyaları */}
                {!isLocked && currentUserId && currentUserRole && (
                  <StepFiles
                    stepId={step.id}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    isDraft={isDraft}
                    readOnly={isGraduated}
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

/**
 * Adımı kim üstlendi + devral/bırak (#367).
 *
 * ⚠️ "Devral" düğmesi BAŞKASININ üstlendiği adımda da görünür. Sprint panosunda
 * iş havuzda durur ve biri çeker; kilitlemek pull modelini bozardı. Kimin
 * gerçekten tamamladığı ayrıca `StepStatusHistory`'de tutuluyor (#324).
 */
function UstlenmeSeridi({
  step,
  currentUserId,
  takimUyeleri,
  calisiyor,
  devre,
  onUstlen,
}: {
  step: Step;
  currentUserId?: string;
  takimUyeleri: TakimUyesi[];
  calisiyor: boolean;
  devre: boolean;
  onUstlen: (assigneeId: string | null) => void;
}) {
  const ustlenen = step.assigneeId
    ? takimUyeleri.find((u) => u.userId === step.assigneeId)
    : null;
  const benimMi = Boolean(currentUserId && step.assigneeId === currentUserId);

  return (
    <span className="flex items-center gap-2">
      {ustlenen ? (
        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
          {benimMi ? "Sen üstlendin" : `${ustlenen.ad} üstlendi`}
        </span>
      ) : (
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          Havuzda
        </span>
      )}

      {!devre && (
        <button
          type="button"
          disabled={calisiyor}
          onClick={() => onUstlen(benimMi ? null : (currentUserId ?? null))}
          className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-50"
        >
          {calisiyor ? (
            <Loader2 className="inline h-3 w-3 animate-spin" />
          ) : benimMi ? (
            "Bırak"
          ) : ustlenen ? (
            "Devral"
          ) : (
            "Üstlen"
          )}
        </button>
      )}
    </span>
  );
}
