"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, ArrowLeft, FolderKanban } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type ProjectTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
};

type FormData = {
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string;
};

const difficultyColors = {
  EASY: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border border-amber-200",
  HARD: "bg-red-50 text-red-700 border border-red-200",
};

export default function ProjectsPage() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    title: "",
    description: "",
    difficulty: "EASY",
    track: "",
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true); // Sayfa yükleniyor durumu

  const loadTemplates = useCallback(async () => {
    try {
      setPageLoading(true);
      const res = await fetch("/api/admin/project-templates");

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load templates:", error);
      setTemplates([]);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function resetForm() {
    setForm({ title: "", description: "", difficulty: "EASY", track: "" });
    setIsFormOpen(false);
    setEditingId(null);
  }

  function startEdit(template: ProjectTemplate) {
    setForm({
      title: template.title,
      description: template.description,
      difficulty: template.difficulty,
      track: template.track.join(", "),
    });
    setEditingId(template.id);
    setIsFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...form,
        track: form.track.split(",").map(t => t.trim()).filter(Boolean),
      };

      let res;
      if (editingId) {
        res = await fetch(`/api/admin/project-templates/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/project-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("Failed to save template");

      await loadTemplates();
      resetForm();
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu proje şablonunu silmek istediğinizden emin misiniz?")) return;

    try {
      const res = await fetch(`/api/admin/project-templates/${id}`, { 
        method: "DELETE" 
      });

      if (!res.ok) {
        throw new Error("Silme işlemi başarısız");
      }

      // Başarılı olursa listeden kaldır
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Silme işlemi başarısız oldu. Lütfen tekrar deneyin.");
      // Hata durumunda listeyi yeniden yükle
      loadTemplates();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="max-w-6xl mx-auto p-6">
      {/* Geri linki */}
      <Link
        href="/admin-dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Yönetici Paneline Dön
      </Link>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Proje Şablonları</h1>
            <p className="text-slate-500 mt-0.5 text-sm">Öğrenciler için proje şablonlarını yönet</p>
          </div>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-200 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Şablon
        </button>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingId ? "Şablonu Düzenle" : "Yeni Şablon Ekle"}
              </h2>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Başlık
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Proje başlığı girin"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Açıklama (Markdown)
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Proje açıklamasını markdown formatında yazın..."
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Markdown formatını kullanabilirsiniz (# başlık, **kalın**, *italik*, vb.)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Zorluk Seviyesi
                  </label>
                  <select
                    value={form.difficulty}
                    onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as "EASY" | "MEDIUM" | "HARD" }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="EASY">Kolay</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="HARD">Zor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Kategoriler
                  </label>
                  <input
                    type="text"
                    value={form.track}
                    onChange={e => setForm(f => ({ ...f, track: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="React, Next.js, TypeScript..."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Virgülle ayırarak birden fazla kategori girebilirsiniz
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? "Kaydediliyor..." : editingId ? "Güncelle" : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading State */}
      {pageLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-slate-600">Şablonlar yükleniyor...</span>
        </div>
      ) : (
        <>
          {/* Templates Grid */}
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Henüz şablon yok</h3>
              <p className="text-slate-600 mb-4">İlk proje şablonunuzu ekleyerek başlayın</p>
              <button
                onClick={() => setIsFormOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                Yeni Şablon Ekle
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {templates.map(template => (
                <div key={template.id} className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
                        {template.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${difficultyColors[template.difficulty]}`}>
                        {template.difficulty === "EASY" ? "Kolay" : 
                         template.difficulty === "MEDIUM" ? "Orta" : "Zor"}
                      </span>
                    </div>

                    <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                      {template.description.slice(0, 120)}...
                    </p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.track.slice(0, 3).map((tag, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded">
                          {tag}
                        </span>
                      ))}
                      {template.track.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-slate-100 text-slate-500 rounded">
                          +{template.track.length - 3} daha
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        ID: {template.id.slice(0, 8)}...
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(template)}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}