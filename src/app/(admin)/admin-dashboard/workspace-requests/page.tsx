"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Github, Loader2, Check, X, Inbox, AlertTriangle } from "lucide-react";
import { tarihBicimle } from "@/lib/tarih";

/**
 * Çalışma alanı talepleri onay kuyruğu (#349).
 *
 * Mentör talebi açar, repoyu admin açar. Bu ekran o kararın verildiği yer.
 */

type Talep = {
  id: string;
  mentorNote: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string | null; email: string };
  assignedProject: {
    id: string;
    githubStatus: string;
    projectTemplate: { title: string };
    studentProfile: { user: { name: string | null; email: string } };
  };
};

export default function WorkspaceRequestsPage() {
  const [talepler, setTalepler] = useState<Talep[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  // #159 deseni: boş liste ile hata AYRI gösterilir; sessizce "talep yok" demek
  // admin'e kuyruğun boş olduğunu düşündürürdü.
  const [hata, setHata] = useState(false);
  const [islenen, setIslenen] = useState<string | null>(null);
  const [redEdilen, setRedEdilen] = useState<string | null>(null);
  const [redNotu, setRedNotu] = useState("");

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const res = await fetch("/api/admin/workspace-requests");
      if (!res.ok) {
        setHata(true);
        return;
      }
      const veri = await res.json();
      setTalepler(veri.talepler ?? []);
    } catch {
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  async function kararVer(id: string, onay: boolean, adminNote?: string) {
    setIslenen(id);
    try {
      const res = await fetch(`/api/admin/workspace-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onay, adminNote }),
      });
      const veri = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof veri.error === "string" ? veri.error : "İşlem başarısız.");
        return;
      }

      toast.success(
        onay
          ? "Onaylandı. Çalışma alanı kurulumu arka planda başlatıldı."
          : "Talep reddedildi.",
      );
      setRedEdilen(null);
      setRedNotu("");
      await getir();
    } catch {
      toast.error("İşlem başarısız. Bağlantınızı kontrol edin.");
    } finally {
      setIslenen(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link
        href="/admin-dashboard"
        className="text-xs font-medium text-indigo-600 hover:underline"
      >
        &larr; Yönetici Paneline Dön
      </Link>

      <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
        Çalışma Alanı Talepleri
      </h1>
      <p className="text-sm text-slate-500 mt-1">
        Mentörlerin, öğrencileri için GitHub çalışma alanı kurulması talepleri.
        Onayladığınızda repo, faz ve issue&apos;lar arka planda oluşturulur.
      </p>

      <div className="mt-6">
        {yukleniyor ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Yükleniyor…
          </div>
        ) : hata ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="w-6 h-6 text-red-600 mx-auto" />
            <p className="mt-2 text-sm font-medium text-red-800">
              Talepler yüklenemedi.
            </p>
            <button
              onClick={getir}
              className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Tekrar dene
            </button>
          </div>
        ) : talepler.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
            <Inbox className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="mt-2 text-sm text-slate-500">Bekleyen talep yok.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {talepler.map((t) => {
              const ogrenci = t.assignedProject.studentProfile.user;
              const bu = islenen === t.id;

              return (
                <li
                  key={t.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900">
                        {ogrenci.name ?? ogrenci.email}
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="font-normal text-slate-600">
                          {t.assignedProject.projectTemplate.title}
                        </span>
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Talep eden: {t.requestedBy.name ?? t.requestedBy.email} ·{" "}
                        {tarihBicimle(t.createdAt)}
                      </p>

                      {t.mentorNote && (
                        <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">
                          {t.mentorNote}
                        </p>
                      )}

                      {/* Önceki kurulum patlamışsa admin bunu ONAYLAMADAN önce
                          bilmeli — aynı hata tekrar edebilir. */}
                      {t.assignedProject.githubStatus === "ERROR" && (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Önceki kurulum hata ile bitmişti
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => kararVer(t.id, true)}
                        disabled={bu}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                      >
                        {bu ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Github className="w-3.5 h-3.5" />
                        )}
                        Onayla ve kur
                      </button>
                      <button
                        onClick={() => {
                          setRedEdilen(redEdilen === t.id ? null : t.id);
                          setRedNotu("");
                        }}
                        disabled={bu}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reddet
                      </button>
                    </div>
                  </div>

                  {redEdilen === t.id && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <label
                        htmlFor={`red-${t.id}`}
                        className="text-xs font-medium text-slate-700"
                      >
                        Red gerekçesi (zorunlu) — mentör bunu görecek
                      </label>
                      <textarea
                        id={`red-${t.id}`}
                        value={redNotu}
                        onChange={(e) => setRedNotu(e.target.value)}
                        maxLength={500}
                        rows={2}
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="Örn: Yol haritasındaki adımlar henüz netleşmemiş."
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setRedEdilen(null)}
                          className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                        >
                          Vazgeç
                        </button>
                        <button
                          onClick={() => kararVer(t.id, false, redNotu)}
                          disabled={bu || redNotu.trim().length === 0}
                          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:bg-slate-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Reddet
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
