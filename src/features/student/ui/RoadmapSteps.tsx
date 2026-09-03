"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle, Lock, ExternalLink, Loader2, Github, ChevronDown, ChevronUp } from "lucide-react";
import { adimKilitli, adimEylemeAcik } from "@/features/roadmap/odak";
import { adimlariGrupla } from "@/features/roadmap/gruplama";
import { adimDurumunuGuncelle } from "@/features/roadmap/ui/adim-durumu-guncelle";
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
  /** #379: Mentörün revizyon gerekçesi — yalnız REVISION_REQUESTED'da dolu. */
  revizyonGerekcesi?: string | null;
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
    setUpdatingId(stepId);
    // #416: Çağrı ortak yardımcıda — odak kartı da aynını kullanıyor.
    const oldu = await adimDurumunuGuncelle({
      stepId,
      yeniDurum: newStatus,
      mezunMu: Boolean(isGraduated),
    });
    if (oldu) {
      // Sayfayı yenile (RSC re-render)
      startTransition(() => {
        router.refresh();
      });
    }
    setUpdatingId(null);
  }

  /*
   * #417: Tamamlanan adımlar tek satıra iniyor.
   *
   * Ölçüm: tamamlanmış adım kartı açık adımla AYNI boyutta (~300px);
   * kilitli adım zaten 116px'e iniyordu. 10 adımlı bir yol haritasında 6
   * tamamlanmış adım ≈ 1800px gereksiz yükseklik.
   */
  const gruplar = adimlariGrupla(steps);

  /*
   * ⚠️ MEZUNDA VARSAYILAN AÇIK. Mezunun portfolyosu salt okunur ama
   * GÖRÜNÜR olmalı (#208): tüm adımları tamamlanmış olduğu için
   * körlemesine katlamak, sertifikanın dayanağı olan işi gizlerdi.
   *
   * ⚠️ Tercih KALICI DEĞİL (bilerek): sayfa her açıldığında aktif işe
   * odaklanmak varsayılan. Kullanıcının bir kez açtığı geçmiş, haftalar
   * sonra da açık gelmemeli.
   */
  const [acikliklar, setAciklik] = useState<Record<string, boolean>>({});
  const grupAcik = (anahtar: string) => acikliklar[anahtar] ?? Boolean(isGraduated);

  return (
    <div className="relative pl-4 md:pl-0">
      {/* Dikey Çizgi (Timeline) */}
      <div className="absolute left-[1.35rem] top-2 bottom-2 w-px bg-slate-200 hidden md:block" />

      <div className="space-y-6">
        {gruplar.map((grup) =>
          grup.tip === "adim" ? (
            adimKarti(grup.adim, grup.indeks)
          ) : (
            <TamamlananGrup
              key={grup.anahtar}
              adet={grup.adimlar.length}
              acik={grupAcik(grup.anahtar)}
              onDegistir={() =>
                setAciklik((ö) => ({
                  ...ö,
                  [grup.anahtar]: !grupAcik(grup.anahtar),
                }))
              }
            >
              {grup.adimlar.map((a, i) => adimKarti(a, grup.indeksler[i]))}
            </TamamlananGrup>
          ),
        )}
      </div>
    </div>
  );

  function adimKarti(step: Step, index: number) {
    {
          const isCompleted = step.status === "COMPLETED";
          const isInProgress = step.status === "IN_PROGRESS";
          // #379: Mentör revizyon istedi. Öğrenci yeniden başlatabilmeli —
          // aksi halde "eksik, revize et" demek adımı KİLİTLERDİ.
          const isRevizyon = step.status === "REVISION_REQUESTED";
          const isTodo = step.status === "TODO";

          /*
           * #416: Kilit ve eyleme açıklık kuralı artık `roadmap/odak.ts`'te.
           *
           * Hesap burada gömülüyken pano aynı soruyu kendi satırıyla
           * yanıtlıyordu; odak kartı üçüncü bir kopya üretecekti. Bu kod
           * tabanında "aynı kural iki yerde" hatası dört kez yaşandı
           * (#367/#370/#376/#393).
           */
          const isLocked = adimKilitli(steps, index);
          const isActionable = adimEylemeAcik(steps, index);

          const isUpdating = updatingId === step.id;

          return (
            <div
              key={step.id}
              /* #416: Odak kartı buraya bağ veriyor. Kaynaklar, dosyalar ve
                 yorumlar kartta KOPYALANMIYOR — iki yerde duran bir
                 yükleyici iki ayrı doğruluk kaynağı olurdu. */
              id={`adim-${step.id}`}
              className="relative flex scroll-mt-24 items-start gap-4"
            >
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
                  {isRevizyon && (
                    <span className="flex items-center text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-1 rounded">
                      Revizyon İstendi
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

                {/* #379: Mentörün gerekçesi. Gerekçesiz revizyon öğrenciye
                    aynı işi tekrar yaptırır — bu yüzden sunucuda ZORUNLU. */}
                {isRevizyon && step.revizyonGerekcesi && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                      Mentörünün revizyon notu
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
                      {step.revizyonGerekcesi}
                    </p>
                  </div>
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
                    {/* ⚠️ Burada `isActionable` KONTROLÜ YOK — ölü mantıktı.
                        Dış kapı zaten `!isLocked` diyor; TODO adımda
                        `isLocked === !isActionable`, revizyonda ise
                        `isActionable` hep true. Yani bu noktaya ulaşıldığında
                        değeri her zaman true oluyordu. Mutasyon testinde
                        bulundu: sabit `true` yapan sürümü hiçbir test
                        öldüremiyordu, çünkü öldürülecek bir davranış yoktu. */}
                    {(isTodo || isRevizyon) && (
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
                        {isUpdating
                          ? "Başlatılıyor..."
                          : isRevizyon
                            ? "Düzeltmeye Başla"
                            : "Bu Adıma Başla"}
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
    }
  }
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

/**
 * Tamamlanmış adımların katlanmış satırı (#417).
 *
 * ⚠️ Zaman çizgisindeki YERİNDE duruyor, listenin başına toplanmıyor:
 * adımlar her zaman sırayla bitmiyor (bir adım revizyondayken sonraki
 * tamamlanmış olabilir) ve hepsini tek yere yığmak "hangi iş nerede bitti"
 * bilgisini kaybettirirdi.
 */
function TamamlananGrup({
  adet,
  acik,
  onDegistir,
  children,
}: {
  adet: number;
  acik: boolean;
  onDegistir: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onDegistir}
        aria-expanded={acik}
        className="flex w-full items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-left transition-colors hover:bg-emerald-50"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="flex-1 text-sm font-medium text-emerald-900">
          {adet} adım tamamlandı
        </span>
        <span className="text-xs font-medium text-emerald-700">
          {acik ? "Gizle" : "Detayları göster"}
        </span>
        {acik ? (
          <ChevronUp className="h-4 w-4 text-emerald-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-emerald-600" />
        )}
      </button>

      {acik && <div className="mt-6 space-y-6">{children}</div>}
    </div>
  );
}
