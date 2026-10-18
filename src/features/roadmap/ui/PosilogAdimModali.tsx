"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Sparkles } from "lucide-react";

export type PosilogAdimModaliProps = {
  studentName: string;
  projectTitle: string;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  setShowAiModal: Dispatch<SetStateAction<boolean>>;
  generatingAiStep: boolean;
  handleGenerateAIStep: () => void;
};

/** Posilog ile yeni yol haritası adımı üretme modal'ı. */
export function PosilogAdimModali({
  studentName,
  projectTitle,
  aiPrompt,
  setAiPrompt,
  setShowAiModal,
  generatingAiStep,
  handleGenerateAIStep,
}: PosilogAdimModaliProps) {
  return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
  <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-primary/20 space-y-5">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Posilog AI Mentör Asistanı
      </h3>
      <button
        onClick={() => setShowAiModal(false)}
        className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
      >
        Kapat
      </button>
    </div>

    <div className="bg-primary/5 p-4 rounded-xl border border-primary/15 text-xs text-primary space-y-1">
      <div className="font-semibold text-sm">💡 Posilog Akıllı Adım Önerisi</div>
      <p>
        Posilog, öğrencini (<strong>{studentName}</strong>) ve projeyi (<strong>{projectTitle}</strong>) analiz ederek mevcut adımların arkasına sıradaki en mantıklı öğrenme fazını otomatik üretecektir.
      </p>
    </div>

    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        Özel İletmek İstediğiniz Konu / İpucu (Opsiyonel)
      </label>
      <textarea
        value={aiPrompt}
        onChange={(e) => setAiPrompt(e.target.value)}
        placeholder="Örn: Docker konteynerleştirme ve CI/CD pipeline kurulumu odaklı bir adım olsun..."
        rows={3}
        className="w-full border rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#3e92cc] outline-none bg-white text-gray-900"
      />
    </div>

    <div className="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={() => setShowAiModal(false)}
        disabled={generatingAiStep}
        className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
      >
        İptal
      </button>
      <button
        type="button"
        onClick={handleGenerateAIStep}
        disabled={generatingAiStep}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-[#3e92cc] hover:from-[#1b2a55] hover:to-[#2f7cb0] text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition disabled:opacity-50"
      >
        {generatingAiStep ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Posilog Üretiyor...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            Posilog ile Adımı Oluştur
          </>
        )}
      </button>
    </div>
  </div>
</div>
  );
}
