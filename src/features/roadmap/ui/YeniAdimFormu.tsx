"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus } from "lucide-react";
import { KaynakListesi } from "@/features/roadmap/ui/KaynakListesi";

export type YeniAdimForm = {
  title: string;
  description: string;
  estimatedHours: number;
  resources: string[];
  githubIssueUrl: string;
};

export type YeniAdimFormuProps = {
  newStepForm: YeniAdimForm;
  setNewStepForm: Dispatch<SetStateAction<YeniAdimForm>>;
  setShowAddForm: (open: boolean) => void;
  saving: boolean;
  handleAddStep: () => void;
  yeniKaynak: {
    ekle: () => void;
    kaldir: (index: number) => void;
    guncelle: (index: number, deger: string) => void;
  };
};

/** Mentörün roadmap'e yeni adım eklediği form (taslakta açılır). */
export function YeniAdimFormu({
  newStepForm,
  setNewStepForm,
  setShowAddForm,
  saving,
  handleAddStep,
  yeniKaynak,
}: YeniAdimFormuProps) {
  return (
  <div className="border-2 border-dashed border-[#3e92cc] rounded-xl p-5 bg-primary/5/30">
    <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
      <Plus className="w-4 h-4" />
      Yeni Adım Ekle
    </h3>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Başlık *</label>
        <input
          type="text"
          value={newStepForm.title}
          onChange={(e) => setNewStepForm({ ...newStepForm, title: e.target.value })}
          placeholder="Adım başlığı..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama *</label>
        <textarea
          value={newStepForm.description}
          onChange={(e) => setNewStepForm({ ...newStepForm, description: e.target.value })}
          rows={3}
          placeholder="Bu adımda ne yapılacak..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tahmini Süre (saat)</label>
        <input
          type="number"
          min={0}
          value={newStepForm.estimatedHours}
          onChange={(e) => setNewStepForm({ ...newStepForm, estimatedHours: parseInt(e.target.value) || 0 })}
          className="w-32 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Issue Linki (opsiyonel)</label>
        <input
          type="text"
          value={newStepForm.githubIssueUrl}
          onChange={(e) => setNewStepForm({ ...newStepForm, githubIssueUrl: e.target.value })}
          placeholder="https://github.com/kullanici/repo/issues/12"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3e92cc] focus:border-[#3e92cc] outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kaynaklar</label>
        <KaynakListesi
          kaynaklar={newStepForm.resources}
          onGuncelle={yeniKaynak.guncelle}
          onKaldir={yeniKaynak.kaldir}
          onEkle={yeniKaynak.ekle}
        />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleAddStep}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-[#1b2a55] text-primary-foreground text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {saving ? "Ekleniyor..." : "Ekle"}
        </button>
        <button
          onClick={() => {
            setShowAddForm(false);
            setNewStepForm({ title: "", description: "", estimatedHours: 2, resources: [""], githubIssueUrl: "" });
          }}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          İptal
        </button>
      </div>
    </div>
  </div>
  );
}
