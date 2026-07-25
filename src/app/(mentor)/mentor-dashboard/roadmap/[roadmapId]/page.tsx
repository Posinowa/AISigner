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
  CheckCircle,
  Clock,
  BookOpen,
  Plus,
  Trash2,
  ExternalLink,
  Pencil,
  X,
  Sparkles,
  Send,
  ChevronDown,
  ChevronUp,
  Github,
  Loader2,
} from "lucide-react";
import { StepComments } from "@/features/messaging/ui/StepComments";
import { StepFiles } from "@/features/files/ui/StepFiles";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/* ─── Tipler ─── */
type RoadmapStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  estimatedHours: number | null;
  resources: string[];
  status: string;
  githubIssueUrl?: string | null;
};

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

const stepStatusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  TODO: { label: "Yapılacak", color: "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200", icon: Clock },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300", icon: BookOpen },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300", icon: CheckCircle },
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

  /* ─── Kaynak Yönetimi (edit) ─── */
  function addEditResource() {
    setEditForm((f) => ({ ...f, resources: [...f.resources, ""] }));
  }
  function removeEditResource(index: number) {
    setEditForm((f) => ({
      ...f,
      resources: f.resources.filter((_, i) => i !== index),
    }));
  }
  function updateEditResource(index: number, value: string) {
    setEditForm((f) => {
      const resources = [...f.resources];
      resources[index] = value;
      return { ...f, resources };
    });
  }

  /* ─── Kaynak Yönetimi (new) ─── */
  function addNewResource() {
    setNewStepForm((f) => ({ ...f, resources: [...f.resources, ""] }));
  }
  function removeNewResource(index: number) {
    setNewStepForm((f) => ({
      ...f,
      resources: f.resources.filter((_, i) => i !== index),
    }));
  }
  function updateNewResource(index: number, value: string) {
    setNewStepForm((f) => {
      const resources = [...f.resources];
      resources[index] = value;
      return { ...f, resources };
    });
  }

  /* ─── Toplam Saat ─── */
  const totalHours = roadmap?.steps.reduce((sum, s) => sum + (s.estimatedHours ?? 0), 0) ?? 0;

  /* ─── Loading / Not Found ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
        <span className="ml-3 text-gray-600 dark:text-slate-300">Yol haritası yükleniyor...</span>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center py-20">
        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Yol haritası bulunamadı</h3>
        <Link href="/mentor-dashboard" className="text-purple-600 dark:text-purple-400 hover:text-purple-800">
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
            className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
                  className="min-w-0 flex-1 text-xl font-bold text-gray-900 dark:text-slate-100 border-b-2 border-purple-500 outline-none bg-transparent py-1"
                  autoFocus
                />
                <button onClick={handleSaveTitle} disabled={saving} className="text-purple-600 dark:text-purple-400 hover:text-purple-800">
                  <Save className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold text-gray-900 dark:text-slate-100 cursor-pointer hover:text-purple-700 transition-colors group"
                onClick={() => {
                  setTitleValue(roadmap.title);
                  setEditingTitle(true);
                }}
              >
                {roadmap.title}
                <Pencil className="w-4 h-4 ml-2 inline text-gray-300 group-hover:text-purple-500 transition-colors" />
              </h1>
            )}
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {studentName} &middot; {project.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider ${
              isDraft
                ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                : "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
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

      {/* Proje Bilgisi + İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 border rounded-xl p-4">
          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Proje</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">{project.title}</div>
          <div className="flex gap-1 mt-2">
            {project.track.slice(0, 3).map((t, i) => (
              <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border rounded-xl p-4">
          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Toplam Adım</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{roadmap.steps.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border rounded-xl p-4">
          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Tahmini Süre</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalHours} <span className="text-sm font-normal text-gray-500 dark:text-slate-400">saat</span></div>
        </div>
        <div className="bg-white dark:bg-slate-900 border rounded-xl p-4">
          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Öğrenci</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">{studentName}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{student.email}</div>
        </div>
      </div>

      {/* Adımlar Listesi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Yol Haritası Adımları
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adım Ekle
          </button>
        </div>

        {roadmap.steps.map((step, index) => {
          const isExpanded = expandedStepId === step.id;
          const isEditing = editingStepId === step.id;
          const statusInfo = stepStatusConfig[step.status] || stepStatusConfig.TODO;
          const StatusIcon = statusInfo.icon;

          return (
            <div
              key={step.id}
              className={`border rounded-xl overflow-hidden transition-all ${
                isEditing
                  ? "border-purple-300 shadow-lg ring-2 ring-purple-100"
                  : "bg-white dark:bg-slate-900 hover:shadow-md"
              }`}
            >
              {/* Adım Başlığı */}
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                onClick={() => {
                  if (!isEditing) {
                    setExpandedStepId(isExpanded ? null : step.id);
                  }
                }}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-sm font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate">{step.title}</h3>
                  {!isExpanded && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{step.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {step.estimatedHours && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {step.estimatedHours}s
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${statusInfo.color}`}>
                    <StatusIcon className="w-3 h-3 inline mr-0.5" />
                    {statusInfo.label}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                  )}
                </div>
              </div>

              {/* Açılır İçerik */}
              {isExpanded && (
                <div className="border-t px-5 pb-5 pt-4 bg-gray-50/50 dark:bg-slate-950/50">
                  {isEditing ? (
                    /* ─── Düzenleme Modu ─── */
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Başlık</label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Açıklama</label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          rows={4}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Tahmini Süre (saat)</label>
                        <input
                          type="number"
                          min={0}
                          value={editForm.estimatedHours}
                          onChange={(e) =>
                            setEditForm({ ...editForm, estimatedHours: parseInt(e.target.value) || 0 })
                          }
                          className="w-32 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">GitHub Issue Linki (opsiyonel)</label>
                        <input
                          type="text"
                          value={editForm.githubIssueUrl}
                          onChange={(e) => setEditForm({ ...editForm, githubIssueUrl: e.target.value })}
                          placeholder="https://github.com/kullanici/repo/issues/12"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Kaynaklar</label>
                        <div className="space-y-2">
                          {editForm.resources.map((res, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={res}
                                onChange={(e) => updateEditResource(i, e.target.value)}
                                placeholder="https://... veya kaynak adı"
                                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                              />
                              <button
                                onClick={() => removeEditResource(i)}
                                className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addEditResource}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 font-medium"
                          >
                            + Kaynak Ekle
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={handleSaveStep}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                        <button
                          onClick={cancelEditStep}
                          className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 font-medium"
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ─── Görüntüleme Modu ─── */
                    <div>
                      <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {step.description}
                      </p>

                      {step.resources.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Kaynaklar
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {step.resources.map((resource, i) => (
                              <a
                                key={i}
                                href={resource.startsWith("http") ? resource : `https://www.google.com/search?q=${encodeURIComponent(resource)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-lg transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {resource.length > 50 ? resource.substring(0, 50) + "..." : resource}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {step.estimatedHours && (
                        <div className="mt-3 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Tahmini: {step.estimatedHours} saat
                        </div>
                      )}

                      {step.githubIssueUrl && (
                        <a
                          href={step.githubIssueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 transition-colors"
                        >
                          <Github className="w-3.5 h-3.5" />
                          {step.githubIssueUrl.replace(/^https:\/\/github\.com\//, "")}
                        </a>
                      )}

                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                        <button
                          onClick={() => startEditStep(step)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteStep(step.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Sil
                        </button>
                      </div>

                      {/* Adım Yorumları */}
                      {sessionData?.user?.id && (
                        <StepComments
                          stepId={step.id}
                          currentUserId={sessionData.user.id}
                          currentUserRole={sessionData.user.role || "MENTOR"}
                        />
                      )}

                      {/* Adım Dosyaları */}
                      {sessionData?.user?.id && (
                        <StepFiles
                          stepId={step.id}
                          currentUserId={sessionData.user.id}
                          currentUserRole={sessionData.user.role || "MENTOR"}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Yeni Adım Ekleme Formu */}
        {showAddForm && (
          <div className="border-2 border-dashed border-purple-300 rounded-xl p-5 bg-purple-50/30 dark:bg-purple-950/40/30">
            <h3 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Yeni Adım Ekle
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Başlık *</label>
                <input
                  type="text"
                  value={newStepForm.title}
                  onChange={(e) => setNewStepForm({ ...newStepForm, title: e.target.value })}
                  placeholder="Adım başlığı..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Açıklama *</label>
                <textarea
                  value={newStepForm.description}
                  onChange={(e) => setNewStepForm({ ...newStepForm, description: e.target.value })}
                  rows={3}
                  placeholder="Bu adımda ne yapılacak..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Tahmini Süre (saat)</label>
                <input
                  type="number"
                  min={0}
                  value={newStepForm.estimatedHours}
                  onChange={(e) => setNewStepForm({ ...newStepForm, estimatedHours: parseInt(e.target.value) || 0 })}
                  className="w-32 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">GitHub Issue Linki (opsiyonel)</label>
                <input
                  type="text"
                  value={newStepForm.githubIssueUrl}
                  onChange={(e) => setNewStepForm({ ...newStepForm, githubIssueUrl: e.target.value })}
                  placeholder="https://github.com/kullanici/repo/issues/12"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Kaynaklar</label>
                <div className="space-y-2">
                  {newStepForm.resources.map((res, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={res}
                        onChange={(e) => updateNewResource(i, e.target.value)}
                        placeholder="https://... veya kaynak adı"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                      />
                      <button
                        onClick={() => removeNewResource(i)}
                        className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addNewResource}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 font-medium"
                  >
                    + Kaynak Ekle
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleAddStep}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {saving ? "Ekleniyor..." : "Ekle"}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewStepForm({ title: "", description: "", estimatedHours: 2, resources: [""], githubIssueUrl: "" });
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 font-medium"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
