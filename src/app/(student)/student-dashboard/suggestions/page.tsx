"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Send, Inbox, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import {
  typeLabels,
  typeStyles,
  statusLabels,
  statusStyles,
  type SuggestionStatus,
  type SuggestionType,
} from "@/features/suggestions/labels";

type Suggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  content: string;
  status: SuggestionStatus;
  adminNote: string | null;
  createdAt: string;
};

const MAX_TITLE = 120;
const MAX_CONTENT = 2000;

export default function StudentSuggestionsPage() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // #163: Sayfalama — nextCursor null ise son sayfadayız.
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [type, setType] = useState<SuggestionType>("SUGGESTION");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await fetch("/api/suggestions");
      if (!res.ok) throw new Error("failed");
      const page = await res.json();
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/suggestions?cursor=${encodeURIComponent(nextCursor)}`);
      if (!res.ok) throw new Error("failed");
      const page = await res.json();
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      toast.error("Daha fazlası yüklenemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, content }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(extractApiErrorMessage(data, "Gönderilemedi. Lütfen tekrar deneyin."));
        return;
      }

      const created: Suggestion = await res.json();
      setItems((prev) => [created, ...prev]);
      setTitle("");
      setContent("");
      toast.success("Mesajınız yöneticiye iletildi.");
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    title.trim().length >= 3 && content.trim().length >= 10 && !submitting;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Öneri & İstek</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
          Platformla ilgili bir öneriniz veya talebiniz mi var? Doğrudan yöneticiye iletin.
        </p>
      </div>

      {/* Gönderim formu */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-6 space-y-5"
      >
        <div className="flex gap-2">
          {(Object.keys(typeLabels) as SuggestionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                type === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {typeLabels[t]}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="suggestion-title" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
            Başlık
          </label>
          <input
            id="suggestion-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE}
            placeholder="Kısa ve net bir başlık"
            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="suggestion-content" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
            Açıklama
          </label>
          <textarea
            id="suggestion-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX_CONTENT}
            rows={5}
            placeholder="Önerinizi veya talebinizi ayrıntılı anlatın (en az 10 karakter)."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:border-blue-500"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 text-right">
            {content.length}/{MAX_CONTENT}
          </p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-slate-300 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Gönder
        </button>
      </form>

      {/* Geçmiş */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-5 flex items-center gap-2">
          <MessageSquareQuote className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          Gönderdiklerim
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Yükleniyor...
          </div>
        ) : loadError ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400 mx-auto mb-3" />
            <p className="text-slate-900 dark:text-slate-100 font-semibold">Kayıtlar yüklenemedi</p>
            <button
              onClick={load}
              className="mt-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 transition-colors"
            >
              Tekrar Dene
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center">
            <Inbox className="w-9 h-9 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Henüz bir öneri veya istek göndermediniz.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-5"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${typeStyles[item.type]}`}>
                    {typeLabels[item.type]}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusStyles[item.status]}`}>
                    {statusLabels[item.status]}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
                    {new Date(item.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{item.content}</p>

                {item.adminNote && (
                  <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Yönetici yanıtı</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{item.adminNote}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div className="mt-5 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
              Daha fazla yükle
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
