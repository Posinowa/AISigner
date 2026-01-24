"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";

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
  EASY: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800", 
  HARD: "bg-red-100 text-red-800"
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

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
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
  }

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
      alert("Silme işlemi başarısız oldu. Lütfen tekrar deneyin.");
      // Hata durumunda listeyi yeniden yükle
      loadTemplates();
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proje Şablonları</h1>
          <p className="text-gray-600 mt-1">Öğrenciler için proje şablonlarını yönetin</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Yeni Şablon
        </button>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingId ? "Şablonu Düzenle" : "Yeni Şablon Ekle"}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Başlık
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Proje başlığı girin"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama (Markdown)
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Proje açıklamasını markdown formatında yazın..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Markdown formatını kullanabilirsiniz (# başlık, **kalın**, *italik*, vb.)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zorluk Seviyesi
                  </label>
                  <select
                    value={form.difficulty}
                    onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="EASY">Kolay</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="HARD">Zor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategoriler
                  </label>
                  <input
                    type="text"
                    value={form.track}
                    onChange={e => setForm(f => ({ ...f, track: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="React, Next.js, TypeScript..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Virgülle ayırarak birden fazla kategori girebilirsiniz
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
          <span className="ml-3 text-gray-600">Şablonlar yükleniyor...</span>
        </div>
      ) : (
        <>
          {/* Templates Grid */}
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz şablon yok</h3>
              <p className="text-gray-600 mb-4">İlk proje şablonunuzu ekleyerek başlayın</p>
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
                <div key={template.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                        {template.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${difficultyColors[template.difficulty]}`}>
                        {template.difficulty === "EASY" ? "Kolay" : 
                         template.difficulty === "MEDIUM" ? "Orta" : "Zor"}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {template.description.slice(0, 120)}...
                    </p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.track.slice(0, 3).map((tag, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                          {tag}
                        </span>
                      ))}
                      {template.track.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                          +{template.track.length - 3} daha
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        ID: {template.id.slice(0, 8)}...
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(template)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
  );
}