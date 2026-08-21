// features/ai/ui/ProfileAnalysisCard.tsx
// #48: Mentor detay sayfası ve admin modal'ı tarafından paylaşılan, #47'de
// saklanan detaylı AI analizini gösteren kart.

import { Award, TrendingUp, Compass, Lightbulb, Layers, Loader2, AlertCircle, Sparkles } from "lucide-react";

export type ProfileAnalysisData = {
  level: string;
  summary: string;
  strengths: string[];
  developmentAreas: string[];
  technicalTracks: string[];
  recommendedPath: string;
  recommendations: string[];
};

type Props = {
  analysis: ProfileAnalysisData | null | undefined;
  loading?: boolean;
  error?: string | null;
};

export type ProfileAnalysisViewState = "loading" | "error" | "empty" | "data";

/**
 * #83: Kartın hangi durumu göstereceğine karar veren saf fonksiyon — bileşenden
 * ayrı test edilebilsin diye çıkarıldı. Öncelik sırası kasıtlı ve sabit:
 * loading > error > empty > data. Örn. loading sırasında eski bir error/analysis
 * hâlâ prop'larda olsa bile loading gösterilir (yarış durumu / stale veri karışmasın).
 */
export function resolveProfileAnalysisViewState(
  props: Pick<Props, "analysis" | "loading" | "error">,
): ProfileAnalysisViewState {
  if (props.loading) return "loading";
  if (props.error) return "error";
  if (!props.analysis) return "empty";
  return "data";
}

/**
 * #83: `GET /api/admin/students/[studentId]/profile-analysis` yanıtını yorumlayan
 * saf fonksiyon (fetch/IO'dan ayrık, test edilebilir). API sözleşmesi:
 * - ok + `{analysis: null}`  → analiz henüz üretilmemiş (empty state, HATA DEĞİL).
 * - ok + `{analysis: {...}}` → analiz bulundu.
 * - !ok                      → gerçek hata (404 profil yok, 500 vb.) — mesaj gösterilir.
 * Bu ayrım olmadan "analiz yok" ile "istek başarısız oldu" birbirine karışabilir.
 */
export function parseProfileAnalysisApiResponse(
  ok: boolean,
  body: { analysis?: ProfileAnalysisData | null; error?: unknown } | null,
): { analysis: ProfileAnalysisData | null; error: string | null } {
  if (ok) {
    return { analysis: body?.analysis ?? null, error: null };
  }
  const message =
    body && typeof body.error === "string" && body.error.trim().length > 0
      ? body.error
      : "Analiz yüklenemedi.";
  return { analysis: null, error: message };
}

export function ProfileAnalysisCard({ analysis, loading, error }: Props) {
  const viewState = resolveProfileAnalysisViewState({ analysis, loading, error });

  if (viewState === "loading") {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Analiz yükleniyor...</span>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 flex flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (viewState === "empty" || !analysis) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center gap-2 text-center">
        <Sparkles className="w-6 h-6 text-slate-300" />
        <p className="text-sm text-slate-500">
          Bu öğrenci için henüz bir AI analizi oluşturulmamış.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 space-y-4 border border-blue-100">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-primary rounded-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Detaylı AI Profil Analizi</h2>
        <span className="ml-auto px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
          {analysis.level}
        </span>
      </div>

      <div className="bg-white rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
        {analysis.summary}
      </div>

      {analysis.technicalTracks.length > 0 && (
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Layers className="w-4 h-4 text-blue-600" />
            Teknik Eğilimler
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.technicalTracks.map((track, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium border border-blue-200"
              >
                {track}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.strengths.length > 0 && (
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Award className="w-4 h-4 text-emerald-600" />
            Güçlü Yönler
          </h3>
          <ul className="space-y-1.5">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-emerald-500 mt-1">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.developmentAreas.length > 0 && (
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            Gelişim Alanları
          </h3>
          <ul className="space-y-1.5">
            {analysis.developmentAreas.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-500 mt-1">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.recommendedPath && (
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2 text-sm">
            <Compass className="w-4 h-4 text-indigo-600" />
            Önerilen Yol
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">{analysis.recommendedPath}</p>
        </div>
      )}

      {analysis.recommendations.length > 0 && (
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            Öneriler
          </h3>
          <ul className="space-y-1.5">
            {analysis.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-yellow-500 mt-1">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
