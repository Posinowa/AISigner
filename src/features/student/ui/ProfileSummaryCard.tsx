// features/student/ui/ProfileSummaryCard.tsx

import { Lightbulb, TrendingUp } from 'lucide-react';
import { experienceLevelLabel } from '@/lib/experience-level';

type Props = {
  summary: string;
  tracks: string[];
  level: string;
  recommendations?: string[];
};

export function ProfileSummaryCard({ summary, tracks, level, recommendations }: Props) {
  // #54: Seviye değeri (ham/küçük harf/AI Türkçe çıktısı) tek standart etikete indirgenir.
  const translatedLevel = experienceLevelLabel(level);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-950 dark:to-slate-950 rounded-xl shadow-md p-6 space-y-5 border border-blue-100">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-blue-600 rounded-lg">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">AI Profil Analizi</h2>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-slate-300">Seviye:</span>
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-sm font-semibold">
            {translatedLevel}
          </span>
        </div>

        <div className="text-gray-700 dark:text-slate-200 text-sm leading-relaxed">
          {summary}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
          Önerilen Teknoloji Alanları
        </h3>
        <div className="flex flex-wrap gap-2">
          {tracks.map((track, i) => (
            <span
              key={i}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 dark:text-blue-300 rounded-lg text-sm font-medium border border-blue-200"
            >
              {track}
            </span>
          ))}
        </div>
      </div>

      {recommendations && recommendations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Kişisel Öneriler
          </h3>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-200">
                <span className="text-yellow-500 mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}