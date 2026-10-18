"use client";

import { CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export type Step = {
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
  /**
   * #407: Bu adımdaki yorum sayısı.
   *
   * ⚠️ "YENİ" DEĞİL, TOPLAM. `StepComment`'ta okunma izi YOK
   * (`id, stepId, authorId, content, createdAt`); "1 yeni yorum" demek yeni
   * bir şema ister. Okunma izi olmadan "yeni" demek uydurma olurdu — sayı,
   * değerin büyük kısmını yanlış bir iddia üretmeden taşıyor.
   */
  yorumSayisi?: number;
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

/**
 * Adımı kim üstlendi + devral/bırak (#367).
 *
 * ⚠️ "Devral" düğmesi BAŞKASININ üstlendiği adımda da görünür. Sprint panosunda
 * iş havuzda durur ve biri çeker; kilitlemek pull modelini bozardı. Kimin
 * gerçekten tamamladığı ayrıca `StepStatusHistory`'de tutuluyor (#324).
 */
export function UstlenmeSeridi({
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
export function TamamlananGrup({
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
