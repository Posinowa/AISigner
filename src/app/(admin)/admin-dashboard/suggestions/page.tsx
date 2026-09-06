"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Inbox, Save } from "lucide-react";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import { tarihBicimle } from "@/lib/tarih";
import {
  authorDisplayName,
  statusLabels,
  statusOrder,
  statusStyles,
  typeLabels,
  typeStyles,
  type SuggestionStatus,
  type SuggestionType,
} from "@/features/suggestions/labels";

type AdminSuggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  content: string;
  status: SuggestionStatus;
  adminNote: string | null;
  createdAt: string;
  author: { id: string; name: string | null; lastName: string | null; email: string };
};

type Filter = "ALL" | SuggestionStatus;

export default function AdminSuggestionsPage() {
  const [items, setItems] = useState<AdminSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [savingId, setSavingId] = useState<string | null>(null);
  // Kaydedilmemiş not taslakları — kayıt id'sine göre tutulur.
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // #163: Filtre artık sunucuda uygulanıyor (sayfalamayla tutarlı olsun diye).
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtreye göre sorgu string'i — "ALL"da status parametresi gitmez.
  const queryFor = (f: Filter, cursor?: string) => {
    const params = new URLSearchParams();
    if (f !== "ALL") params.set("status", f);
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString();
    return `/api/admin/suggestions${qs ? `?${qs}` : ""}`;
  };

  const load = useCallback(async (f: Filter) => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await fetch(queryFor(f));
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
      const res = await fetch(queryFor(filter, nextCursor));
      if (!res.ok) throw new Error("failed");
      const page = await res.json();
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      toast.error("Daha fazlası yüklenemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoadingMore(false);
    }
  }, [filter, nextCursor, loadingMore]);

  // Filtre değişince baştan yükle (cursor sıfırlanır).
  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function patch(id: string, data: { status?: SuggestionStatus; adminNote?: string }) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(extractApiErrorMessage(body, "Güncellenemedi. Lütfen tekrar deneyin."));
        return;
      }

      const updated: AdminSuggestion = await res.json();
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success("Güncellendi.");
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSavingId(null);
    }
  }

  // #163: Filtreleme sunucuda yapıldığı için gelen liste zaten filtrelenmiş.
  const visible = items;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Öneri & İstek</h1>
        <p className="text-slate-500 mt-1.5 text-sm">
          Stajyerlerden gelen öneri ve talepleri inceleyin, durumlarını güncelleyin.
          Açık kayıtları görmek için <span className="font-medium">Açık</span> filtresini kullanın.
        </p>
      </div>

      {/* Durum filtresi */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", ...statusOrder] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              filter === f
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f === "ALL" ? "Tümü" : statusLabels[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Yükleniyor...
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-slate-900 font-semibold">Kayıtlar yüklenemedi</p>
          <button
            onClick={() => load(filter)}
            className="mt-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
          <Inbox className="w-9 h-9 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {filter === "ALL"
              ? "Henüz bir öneri veya istek gelmedi."
              : "Bu durumda kayıt bulunmuyor."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((item) => {
            const draft = noteDrafts[item.id] ?? item.adminNote ?? "";
            const noteChanged = draft !== (item.adminNote ?? "");
            const busy = savingId === item.id;

            return (
              <li
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${typeStyles[item.type]}`}>
                    {typeLabels[item.type]}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusStyles[item.status]}`}>
                    {statusLabels[item.status]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {authorDisplayName(item.author)}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {tarihBicimle(item.createdAt)}
                  </span>
                </div>

                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.content}</p>

                {/* Durum değiştirme */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-500 mr-1">Durum:</span>
                  {statusOrder.map((s) => (
                    <button
                      key={s}
                      onClick={() => patch(item.id, { status: s })}
                      disabled={busy || item.status === s}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        item.status === s
                          ? statusStyles[s]
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {statusLabels[s]}
                    </button>
                  ))}
                </div>

                {/* Yönetici notu */}
                <div className="mt-4">
                  <label
                    htmlFor={`note-${item.id}`}
                    className="block text-xs font-medium text-slate-500 mb-1.5"
                  >
                    Yönetici yanıtı (öğrenciye gösterilir)
                  </label>
                  <textarea
                    id={`note-${item.id}`}
                    value={draft}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    maxLength={2000}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:border-blue-500"
                  />
                  <button
                    onClick={() => patch(item.id, { adminNote: draft })}
                    disabled={busy || !noteChanged}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Notu Kaydet
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !loadError && nextCursor && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            Daha fazla yükle
          </button>
        </div>
      )}
    </div>
  );
}
