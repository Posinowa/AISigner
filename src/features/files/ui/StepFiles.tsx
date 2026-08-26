"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Paperclip,
  Upload,
  Loader2,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  X,
  Eye,
} from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type StepFile = {
  id: string;
  stepId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploader: {
    id: string;
    name: string | null;
    lastName: string | null;
    role: string;
  };
};

type Props = {
  stepId: string;
  currentUserId: string;
  currentUserRole: string;
  isDraft?: boolean;
  readOnly?: boolean;
};

export function StepFiles({ stepId, currentUserId, currentUserRole, isDraft, readOnly }: Props) {
  const confirm = useConfirm();
  // #52: Taslak roadmap'te öğrenci dosya yükleyemez. #208: Mezun portfolyoda salt-okunurdur.
  const interactionLocked = (isDraft && currentUserRole === "STUDENT") || (readOnly && currentUserRole === "STUDENT");
  const [files, setFiles] = useState<StepFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFullName = (user: { name: string | null; lastName: string | null }) =>
    [user.name, user.lastName].filter(Boolean).join(" ") || "İsimsiz";

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-pink-500" />;
    if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
    if (mimeType.includes("zip")) return <FileArchive className="w-4 h-4 text-yellow-600" />;
    if (
      mimeType.includes("javascript") ||
      mimeType.includes("typescript") ||
      mimeType.includes("json") ||
      mimeType.includes("html") ||
      mimeType.includes("css")
    )
      return <FileCode className="w-4 h-4 text-blue-500" />;
    return <FileText className="w-4 h-4 text-slate-500" />;
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/steps/${stepId}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
      }
    } catch {
      setError("Dosyalar yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [stepId]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/steps/${stepId}/files`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setFiles((prev) => [data.file, ...prev]);
      } else {
        const data = await res.json();
        setError(data.error || "Dosya yüklenirken hata oluştu.");
      }
    } catch {
      setError("Dosya yüklenirken bağlantı hatası.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId: string) {
    const ok = await confirm({
      title: "Dosyayı sil",
      description: "Bu dosyayı silmek istediğinizden emin misiniz?",
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/steps/${stepId}/files/${fileId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        const data = await res.json();
        setError(data.error || "Dosya silinirken hata oluştu.");
      }
    } catch {
      setError("Dosya silinirken bağlantı hatası.");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Input'u sıfırla (aynı dosyayı tekrar seçebilmek için)
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  function canDelete(file: StepFile) {
    if (readOnly && currentUserRole === "STUDENT") return false;
    // Yükleyen veya mentor silebilir
    return file.uploader.id === currentUserId || currentUserRole === "MENTOR";
  }

  useEffect(() => {
    if (isOpen && files.length === 0) {
      loadFiles();
    }
  }, [isOpen, files.length, loadFiles]);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      {/* Toggle Butonu */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors group"
      >
        <Paperclip className="w-3.5 h-3.5 group-hover:text-amber-600 transition-colors" />
        <span>Dosyalar{files.length > 0 ? ` (${files.length})` : ""}</span>
      </button>

      {/* Dosya Paneli */}
      {isOpen && (
        <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Upload Alanı — taslak roadmap'te öğrenci yükleyemez (#52) */}
          {interactionLocked ? (
            <p className="text-[11px] text-slate-400 text-center border-2 border-dashed border-slate-200 rounded-lg p-4">
              Bu yol haritası taslak aşamasında. Mentörünüz yayınladığında dosya yükleyebilirsiniz.
            </p>
          ) : (
            <div
              className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
                ${dragOver
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                }
                ${uploading ? "pointer-events-none opacity-60" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onFileChange}
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.csv,.json,.zip,.js,.ts,.tsx,.jsx,.css,.py,.java,.go,.rs,.c,.cpp,.h,.sql"
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 py-1">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-xs text-slate-500">Yükleniyor...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 py-1">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-xs text-slate-500">
                    Dosyayı sürükleyin veya tıklayıp seçin
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Maks. 10 MB &middot; Resim, PDF, Kod, ZIP
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Hata Mesajı */}
          {error && (
            <div className="flex items-center justify-between text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <span>{error}</span>
              <button onClick={() => setError(null)} aria-label="Hatayı kapat" className="ml-2 hover:text-red-800">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Yükleniyor */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          )}

          {/* Dosya Listesi */}
          {!loading && files.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">
              Henüz dosya yüklenmemiş.
            </p>
          )}

          {!loading && files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-3 bg-white border border-slate-100 rounded-lg px-3 py-2.5 group hover:border-slate-200 transition-colors"
                >
                  {/* Dosya İkonu */}
                  <div className="shrink-0">{getFileIcon(file.mimeType)}</div>

                  {/* Dosya Bilgileri */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate" title={file.fileName}>
                      {file.fileName}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatFileSize(file.fileSize)} &middot; {getFullName(file.uploader)} &middot;{" "}
                      {formatDate(file.createdAt)}
                    </p>
                  </div>

                  {/* Aksiyonlar */}
                  <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {/* Önizle/İndir */}
                    {file.mimeType.startsWith("image/") || file.mimeType === "application/pdf" ? (
                      <a
                        href={`/api/steps/${stepId}/files/${file.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        aria-label={`${file.fileName} dosyasını önizle`}
                        title="Önizle"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <a
                        href={`/api/steps/${stepId}/files/${file.id}`}
                        download
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        aria-label={`${file.fileName} dosyasını indir`}
                        title="İndir"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Sil */}
                    {canDelete(file) && (
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        aria-label={`${file.fileName} dosyasını sil`}
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
