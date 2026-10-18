"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import {
  ArrowLeft,
  Save,
  Plus,
  Pencil,
  X,
  Sparkles,
  Send,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { TASLAK_SONUCU } from "@/features/roadmap/taslak";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { kaynakEkle, kaynakKaldir, kaynakGuncelle } from "@/features/roadmap/kaynaklar";
import { YeniAdimFormu } from "@/features/roadmap/ui/YeniAdimFormu";
import { PosilogAdimModali } from "@/features/roadmap/ui/PosilogAdimModali";
import { RoadmapAdimKarti, type RoadmapStep } from "@/features/roadmap/ui/RoadmapAdimKarti";

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
export default function RoadmapReviewPage() {
  const confirm = useConfirm();
  const params = useParams();
  const router = useRouter();
  const { data: sessionData } = useSession();
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

  /* ─── Loading / Not Found ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-gray-600">Yol haritası yükleniyor...</span>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center py-20">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Yol haritası bulunamadı</h3>
        <Link href="/mentor-dashboard" className="text-primary hover:text-[#3e92cc]">
          ← Dashboard&apos;a dön
        </Link>
      </div>
    );
  }

  const student = roadmap.assignedProject.studentProfile.user;
  const studentName = [student.name, student.lastName].filter(Boolean).join(" ") || "İsimsiz Öğrenci";
  const project = roadmap.assignedProject.projectTemplate;
  const isDraft = roadmap.status === "DRAFT";

  /* ─── Render ─── */
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="min-w-0 flex-1 text-xl font-bold text-gray-900 border-b-2 border-primary outline-none bg-transparent py-1"
                  autoFocus
                />
                <button onClick={handleSaveTitle} disabled={saving} className="text-primary hover:text-[#3e92cc]">
                  <Save className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-primary transition-colors group"
                onClick={() => {
                  setTitleValue(roadmap.title);
                  setEditingTitle(true);
                }}
              >
                {roadmap.title}
                <Pencil className="w-4 h-4 ml-2 inline text-gray-300 group-hover:text-[#3e92cc] transition-colors" />
              </h1>
            )}
            <p className="text-sm text-gray-500 mt-1">
              {studentName} &middot; {project.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider ${
              isDraft
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {isDraft ? "Taslak" : "Yayında"}
          </span>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isDraft
                ? "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                : "bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm"
            }`}
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDraft ? (
              <Send className="w-4 h-4" />
            ) : (
              <Pencil className="w-4 h-4" />
            )}
            {isDraft ? "Onayla ve Yayınla" : "Taslağa Al"}
          </button>
        </div>
      </div>

      {/* #405: Rozet durumu söylüyordu, SONUCUNU değil. Mentör "Taslak"ı
          görüp stajyerin hiçbir adımı göremediğini fark etmiyordu.

          ⚠️ Uyarı ENGELLEYİCİ DEĞİL: düzenleme sırasında taslağa geri almak
          meşru bir işlem. Amaç durdurmak değil, unutulmasını önlemek. */}
      {isDraft && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Bu yol haritası henüz taslak.
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-amber-800">
              {TASLAK_SONUCU}
            </p>
          </div>
        </div>
      )}

      {/* Proje Bilgisi + İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Proje</div>
          <div className="text-sm font-semibold text-gray-900">{project.title}</div>
          <div className="flex gap-1 mt-2">
            {project.track.slice(0, 3).map((t, i) => (
              <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Toplam Adım</div>
          <div className="text-2xl font-bold text-primary">{roadmap.steps.length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Tahmini Süre</div>
          <div className="text-2xl font-bold text-blue-700">{totalHours} <span className="text-sm font-normal text-gray-500">saat</span></div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Öğrenci</div>
          <div className="text-sm font-semibold text-gray-900">{studentName}</div>
          <div className="text-xs text-gray-500 mt-1">{student.email}</div>
        </div>
      </div>

      {/* Adımlar Listesi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Yol Haritası Adımları
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-gradient-to-r from-primary to-[#3e92cc] hover:from-[#1b2a55] hover:to-[#2f7cb0] text-primary-foreground rounded-lg transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Posilog ile Adım Üret
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adım Ekle
            </button>
          </div>
        </div>

        {roadmap.steps.map((step, index) => (
          <RoadmapAdimKarti
            key={step.id}
            step={step}
            index={index}
            toplamAdim={roadmap.steps.length}
            isExpanded={expandedStepId === step.id}
            isEditing={editingStepId === step.id}
            tasinan={tasinan}
            editForm={editForm}
            setEditForm={setEditForm}
            editKaynak={editKaynak}
            saving={saving}
            kullanici={sessionData?.user}
            setExpandedStepId={setExpandedStepId}
            handleTasi={handleTasi}
            startEditStep={startEditStep}
            cancelEditStep={cancelEditStep}
            handleSaveStep={handleSaveStep}
            handleDeleteStep={handleDeleteStep}
            loadRoadmap={loadRoadmap}
          />
        ))}

        {/* Yeni Adım Ekleme Formu */}
        {showAddForm && (
          <YeniAdimFormu
            newStepForm={newStepForm}
            setNewStepForm={setNewStepForm}
            setShowAddForm={setShowAddForm}
            saving={saving}
            handleAddStep={handleAddStep}
            yeniKaynak={yeniKaynak}
          />
        )}
      </div>

      {/* 🤖 Posilog AI Asistanı Modal */}
      {showAiModal && (
        <PosilogAdimModali
          studentName={studentName}
          projectTitle={project.title}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          setShowAiModal={setShowAiModal}
          generatingAiStep={generatingAiStep}
          handleGenerateAIStep={handleGenerateAIStep}
        />
      )}
    </div>
  );
}
