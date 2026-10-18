"use client";

import { useEffect, useState, useCallback } from "react";

import { toast } from "sonner";

import { useConfirm } from "@/components/ui/ConfirmDialog";

import { useModalA11y } from "@/components/ui/useModalA11y";

import { extractApiErrorMessage } from "@/lib/api-error-message";

type ProjectTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
  githubRepoUrl?: string | null;
  /** #503: Aynı stajyere birden çok kez atanabilir mi? */
  tekrarlanabilir?: boolean;
};

type FormData = {
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string;
  githubRepoUrl: string;
  tekrarlanabilir: boolean;
};

/** useProjeSablonlari: sayfanın durum ve eylemleri (sunum sayfada). */
export function useProjeSablonlari() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    title: "",
    description: "",
    difficulty: "EASY",
    track: "",
    githubRepoUrl: "",
    tekrarlanabilir: false,
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true); // Sayfa yükleniyor durumu
  // #59: Fetch başarısız olduğunda "hiç şablon yok" ile "istek başarısız oldu"
  // birbirine karışmasın diye ayrı bir hata durumu.
  const [loadError, setLoadError] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setPageLoading(true);
      setLoadError(false);
      const res = await fetch("/api/admin/project-templates");

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load templates:", error);
      setLoadError(true);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function resetForm() {
    setForm({
      title: "",
      description: "",
      difficulty: "EASY",
      track: "",
      githubRepoUrl: "",
      tekrarlanabilir: false,
    });
    setIsFormOpen(false);
    setEditingId(null);
  }

  // Modal a11y: Escape ile kapat + açılışta panele odak.
  const formModalRef = useModalA11y(isFormOpen, resetForm);

  function startEdit(template: ProjectTemplate) {
    setForm({
      title: template.title,
      description: template.description,
      difficulty: template.difficulty,
      track: template.track.join(", "),
      githubRepoUrl: template.githubRepoUrl ?? "",
      // #508: Düzenlemede mevcut değer yüklenmezse form her açılışta bayrağı
      // sıfırlar ve admin farkında olmadan KAPATIR.
      tekrarlanabilir: template.tekrarlanabilir ?? false,
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
        // #49: Boş input -> null (repo linki opsiyonel; boş string geçersiz URL sayılmasın).
        githubRepoUrl: form.githubRepoUrl.trim() === "" ? null : form.githubRepoUrl.trim(),
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

      if (!res.ok) {
        // #114: string / fieldErrors ayrımı ortak helper'da (test edilen tek kaynak).
        const data = await res.json().catch(() => null);
        toast.error(extractApiErrorMessage(data, "Şablon kaydedilemedi."));
        return;
      }

      await loadTemplates();
      resetForm();
      toast.success(editingId ? "Şablon güncellendi." : "Şablon oluşturuldu.");
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Proje şablonunu sil",
      description: "Bu proje şablonunu silmek istediğinizden emin misiniz?",
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;

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

  return { confirm, templates, setTemplates, isFormOpen, setIsFormOpen, editingId, setEditingId, form, setForm, loading, setLoading, pageLoading, setPageLoading, loadError, setLoadError, loadTemplates, resetForm, formModalRef, startEdit, handleSubmit, handleDelete };
}
