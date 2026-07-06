"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Loader2, Trash2, Pencil, X, User } from "lucide-react";
import { toast } from "sonner";

type Comment = {
  id: string;
  stepId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
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
};

export function StepComments({ stepId, currentUserId, currentUserRole, isDraft }: Props) {
  // #52: Taslak roadmap'te öğrenci yorum ekleyemez (mentor inceleme için ekleyebilir).
  const interactionLocked = isDraft && currentUserRole === "STUDENT";
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const getFullName = (user: { name: string | null; lastName: string | null }) =>
    [user.name, user.lastName].filter(Boolean).join(" ") || "İsimsiz";

  const getRoleInfo = (role: string) => {
    if (role === "MENTOR") return { label: "Mentor", color: "bg-purple-100 text-purple-700", ring: "ring-purple-200" };
    return { label: "Öğrenci", color: "bg-blue-100 text-blue-700", ring: "ring-blue-200" };
  };

  async function loadComments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/steps/${stepId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch (error) {
      console.error("Yorumlar yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) loadComments();
  }, [isOpen, stepId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/steps/${stepId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      } else {
        const err = await res.json();
        toast.error(err.error || "Yorum gönderilemedi.");
      }
    } catch {
      toast.error("Bağlantı hatası.");
    } finally {
      setSending(false);
    }
  }

  async function handleUpdate(commentId: string) {
    if (!editContent.trim()) return;

    try {
      const res = await fetch(`/api/steps/${stepId}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? data.comment : c))
        );
        setEditingId(null);
        setEditContent("");
      } else {
        const err = await res.json();
        toast.error(err.error || "Yorum güncellenemedi.");
      }
    } catch {
      toast.error("Bağlantı hatası.");
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Bu yorumu silmek istediğinizden emin misiniz?")) return;

    try {
      const res = await fetch(`/api/steps/${stepId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } else {
        const err = await res.json();
        toast.error(err.error || "Yorum silinemedi.");
      }
    } catch {
      toast.error("Bağlantı hatası.");
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function canDelete(comment: Comment) {
    // Yorum sahibi veya mentor silebilir
    return comment.author.id === currentUserId || currentUserRole === "MENTOR";
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors gap-1.5"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        {isOpen ? "Yorumları Gizle" : `Yorumlar${comments.length > 0 ? ` (${comments.length})` : ""}`}
      </button>

      {isOpen && (
        <div className="mt-3 bg-slate-50/80 rounded-lg border border-slate-200 p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="ml-2 text-xs text-gray-500">Yükleniyor...</span>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">
              Henüz yorum yok. İlk yorumu ekleyin!
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.map((comment) => {
                const roleInfo = getRoleInfo(comment.author.role);
                const isEditing = editingId === comment.id;

                return (
                  <div key={comment.id} className="flex gap-2.5 group">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ${roleInfo.ring} bg-white`}>
                      <User className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-gray-800">
                          {getFullName(comment.author)}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="flex gap-2 items-end">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            maxLength={1000}
                            rows={2}
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleUpdate(comment.id)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              aria-label="Yorumu kaydet"
                              title="Kaydet"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditContent(""); }}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              aria-label="Düzenlemeyi iptal et"
                              title="İptal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                            {comment.content}
                          </p>
                          <div className="flex gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            {comment.author.id === currentUserId && (
                              <button
                                onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                                className="p-1 text-gray-400 hover:text-blue-600"
                                aria-label="Yorumu düzenle"
                                title="Düzenle"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {canDelete(comment) && (
                              <button
                                onClick={() => handleDelete(comment.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                aria-label="Yorumu sil"
                                title="Sil"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Yorum Gönder — taslak roadmap'te öğrenci etkileşim kuramaz (#52) */}
          {interactionLocked ? (
            <p className="text-[11px] text-slate-400 text-center pt-2 border-t border-slate-200">
              Bu yol haritası taslak aşamasında. Mentörünüz yayınladığında yorum ekleyebilirsiniz.
            </p>
          ) : (
            <form onSubmit={handleSend} className="flex gap-2 items-end pt-2 border-t border-slate-200">
              <textarea
                ref={inputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Yorumunuzu yazın..."
                maxLength={1000}
                rows={2}
                className="flex-1 text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || sending}
                className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
