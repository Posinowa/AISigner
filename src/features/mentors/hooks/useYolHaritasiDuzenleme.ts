"use client";

import { useEffect, useState, useCallback } from "react";

import { useParams, useRouter } from "next/navigation";

import { toast } from "sonner";
import { extractApiErrorMessage } from "@/lib/api-error-message";

import { useConfirm } from "@/components/ui/ConfirmDialog";

import { kaynakEkle, kaynakKaldir, kaynakGuncelle } from "@/features/roadmap/kaynaklar";

import { type RoadmapStep } from "@/features/roadmap/ui/RoadmapAdimKarti";

/* ─── Tipler ─── */
type Roadmap = {
  id: string;
  title: string;
  status: string;
  steps: RoadmapStep[];
  assignedProject: {
    id: string;
    status: string;
    projectTemplate: {
      id: string;
      title: string;
      description: string;
      track: string[];
      difficulty: string;
    };
    studentProfile: {
      id: string;
      user: {
        name: string | null;
        lastName: string | null;
        email: string;
      };
    };
  };
  createdAt: string;
  updatedAt: string;
};

// #50: Boş input -> null (issue linki opsiyonel; boş string geçersiz URL sayılmasın).
function toNullableUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// #50: Yanıt gövdesindeki hatayı okunabilir tek mesaja indirger.
// #126-3: Ayrıştırma (string vs zod fieldErrors) ortak helper'da — tek kaynak.
async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return extractApiErrorMessage(data, fallback);
}

/* ─── Sayfa ─── */

/** useYolHaritasiDuzenleme: sayfanın durum ve eylemleri (sunum sayfada). */
export function useYolHaritasiDuzenleme() {
  const confirm = useConfirm();
  const params = useParams();
  const router = useRouter();
  const roadmapId = params.roadmapId as string;

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Düzenleme state'leri
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    estimatedHours: 0,
    resources: [""],
    githubIssueUrl: "",
  });

  // Yeni adım ekleme
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStepForm, setNewStepForm] = useState({
    title: "",
    description: "",
    estimatedHours: 2,
    resources: [""],
    githubIssueUrl: "",
  });

  // Posilog AI Asistanı State
  const [generatingAiStep, setGeneratingAiStep] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  async function handleGenerateAIStep() {
    setGeneratingAiStep(true);
    try {
      const res = await fetch(`/api/mentor/roadmap/${roadmapId}/ai-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "AI adımı üretilemedi");
      }
      toast.success(data.message || "Posilog tarafından yeni adım üretildi!");
      setShowAiModal(false);
      setAiPrompt("");
      await loadRoadmap();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Hata oluştu";
      toast.error(msg);
    } finally {
      setGeneratingAiStep(false);
    }
  }

  // Hangi adım açık (accordion)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  /* ─── Veri Çekme ─── */
  const loadRoadmap = useCallback(async () => {
    try {
      const res = await fetch(`/api/mentor/roadmap/${roadmapId}`);
      if (res.ok) {
        const data: Roadmap = await res.json();
        setRoadmap(data);
      }
    } catch (error) {
      console.error("Roadmap yükleme hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [roadmapId]);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  /* ─── Başlık Düzenleme ─── */
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  async function handleSaveTitle() {
    if (!roadmap || !titleValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/mentor/roadmap/${roadmapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue.trim() }),
      });
      if (res.ok) {
        await loadRoadmap();
        setEditingTitle(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  /* ─── Adım sırasını değiştir (#406) ─── */
  //
  // Sıra numarasını istemci HESAPLAMIYOR: yalnız "hangi adım, hangi yön"
  // gönderiyor. Tabanı sunucu belirliyor, aksi halde iki adım aynı sırada
  // kalabilirdi.
  const [tasinan, setTasinan] = useState<string | null>(null);

  async function handleTasi(stepId: string, yon: "yukari" | "asagi") {
    setTasinan(stepId);
    try {
      const res = await fetch(`/api/mentor/roadmap/${roadmapId}/steps/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, yon }),
      });
      if (!res.ok) {
        toast.error(await extractErrorMessage(res, "Adım taşınamadı."));
        return;
      }
      await loadRoadmap();
    } catch {
      toast.error("Adım taşınamadı. Bağlantınızı kontrol edin.");
    } finally {
      setTasinan(null);
    }
  }

  /* ─── Yayınla / Taslağa Al ─── */
  async function handlePublish() {
    if (!roadmap) return;
    const newStatus = roadmap.status === "DRAFT" ? "PUBLISHED" : "DRAFT";
    setPublishing(true);
    try {
      const res = await fetch(`/api/mentor/roadmap/${roadmapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadRoadmap();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setPublishing(false);
    }
  }

  /* ─── Adım Düzenleme ─── */
  function startEditStep(step: RoadmapStep) {
    setEditingStepId(step.id);
    setEditForm({
      title: step.title,
      description: step.description,
      estimatedHours: step.estimatedHours ?? 0,
      resources: step.resources.length > 0 ? [...step.resources] : [""],
      githubIssueUrl: step.githubIssueUrl ?? "",
    });
    setExpandedStepId(step.id);
  }

  function cancelEditStep() {
    setEditingStepId(null);
    setEditForm({ title: "", description: "", estimatedHours: 0, resources: [""], githubIssueUrl: "" });
  }

  async function handleSaveStep() {
    if (!editingStepId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/mentor/roadmap/${roadmapId}/steps/${editingStepId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editForm.title,
            description: editForm.description,
            estimatedHours: editForm.estimatedHours || null,
            resources: editForm.resources.filter((r) => r.trim() !== ""),
            githubIssueUrl: toNullableUrl(editForm.githubIssueUrl),
          }),
        }
      );
      if (res.ok) {
        await loadRoadmap();
        cancelEditStep();
      } else {
        toast.error(await extractErrorMessage(res, "Adım güncellenemedi."));
      }
    } catch (error) {
      console.error(error);
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Adım Silme ─── */
  async function handleDeleteStep(stepId: string) {
    const ok = await confirm({
      title: "Adımı sil",
      description: "Bu adımı silmek istediğinize emin misiniz?",
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(
        `/api/mentor/roadmap/${roadmapId}/steps/${stepId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await loadRoadmap();
        if (editingStepId === stepId) cancelEditStep();
      }
    } catch (error) {
      console.error(error);
    }
  }

  /* ─── Yeni Adım Ekleme ─── */
  async function handleAddStep() {
    if (!newStepForm.title.trim() || !newStepForm.description.trim()) {
      toast.error("Başlık ve açıklama zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/mentor/roadmap/${roadmapId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newStepForm.title,
          description: newStepForm.description,
          estimatedHours: newStepForm.estimatedHours || null,
          resources: newStepForm.resources.filter((r) => r.trim() !== ""),
          githubIssueUrl: toNullableUrl(newStepForm.githubIssueUrl),
        }),
      });
      if (res.ok) {
        await loadRoadmap();
        setShowAddForm(false);
        setNewStepForm({ title: "", description: "", estimatedHours: 2, resources: [""], githubIssueUrl: "" });
      } else {
        toast.error(await extractErrorMessage(res, "Adım eklenemedi."));
      }
    } catch (error) {
      console.error(error);
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Kaynak Yönetimi ───
   *
   * #494: Bu üç işlem İKİ KEZ yazılıydı (düzenleme formu + yeni adım formu)
   * ve gövdeleri birbirinin aynısıydı. Mantık artık `roadmap/kaynaklar.ts`'te;
   * buradaki sarmalayıcılar yalnız hangi state'e yazılacağını söylüyor.
   */
  const editKaynak = {
    ekle: () => setEditForm((f) => ({ ...f, resources: kaynakEkle(f.resources) })),
    kaldir: (i: number) =>
      setEditForm((f) => ({ ...f, resources: kaynakKaldir(f.resources, i) })),
    guncelle: (i: number, v: string) =>
      setEditForm((f) => ({ ...f, resources: kaynakGuncelle(f.resources, i, v) })),
  };
  const yeniKaynak = {
    ekle: () => setNewStepForm((f) => ({ ...f, resources: kaynakEkle(f.resources) })),
    kaldir: (i: number) =>
      setNewStepForm((f) => ({ ...f, resources: kaynakKaldir(f.resources, i) })),
    guncelle: (i: number, v: string) =>
      setNewStepForm((f) => ({ ...f, resources: kaynakGuncelle(f.resources, i, v) })),
  };

  /* ─── Toplam Saat ─── */
  const totalHours = roadmap?.steps.reduce((sum, s) => sum + (s.estimatedHours ?? 0), 0) ?? 0;

  return { confirm, params, router, roadmapId, roadmap, setRoadmap, loading, setLoading, saving, setSaving, publishing, setPublishing, editingStepId, setEditingStepId, editForm, setEditForm, showAddForm, setShowAddForm, newStepForm, setNewStepForm, generatingAiStep, setGeneratingAiStep, showAiModal, setShowAiModal, aiPrompt, setAiPrompt, handleGenerateAIStep, expandedStepId, setExpandedStepId, loadRoadmap, editingTitle, setEditingTitle, titleValue, setTitleValue, handleSaveTitle, tasinan, setTasinan, handleTasi, handlePublish, startEditStep, cancelEditStep, handleSaveStep, handleDeleteStep, handleAddStep, editKaynak, yeniKaynak, totalHours };
}
