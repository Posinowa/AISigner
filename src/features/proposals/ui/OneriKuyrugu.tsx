"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Inbox, Github, RefreshCw, Check, X } from "lucide-react";

/**
 * Proje önerisi onay kuyruğu (#366).
 *
 * ⚠️ KAYNAK KARARI ADMİN'İN. Stajyerin tercihi gösteriliyor ama admin
 * değiştirebiliyor — hem depo bağlama hem devretme organizasyonu ilgilendirir.
 *
 * ⚠️ DEVRET'te "devir tamamlandı mı" GitHub'a SORULUYOR, tahmin edilmiyor.
 * Transferi platform başlatamaz; yalnızca gerçekleştiğini tespit edebilir.
 */

const KAYNAK_ETIKETLERI: Record<string, string> = {
  BIZIM: "Repoyu biz açalım",
  BAGLA: "Var olan depoyu bağla",
  DEVRET: "Organizasyona devret",
};

type Oneri = {
  id: string;
  title: string;
  description: string;
  goals: string;
  technologies: string[];
  kaynak: string;
  repoUrl: string | null;
  createdAt: string;
  studentProfile: {
    experienceLevel: string;
    user: { id: string; name: string | null; lastName: string | null; email: string };
  };
};

export function OneriKuyrugu() {
  const [oneriler, setOneriler] = useState<Oneri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(false);
  const [islenen, setIslenen] = useState<string | null>(null);
  const [redEdilen, setRedEdilen] = useState<string | null>(null);
  const [redNotu, setRedNotu] = useState("");
  const [kaynaklar, setKaynaklar] = useState<Record<string, string>>({});
  const [devirDurumu, setDevirDurumu] = useState<Record<string, boolean | null>>({});

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const res = await fetch("/api/admin/proposals");
      if (!res.ok) {
        setHata(true);
        return;
      }
      setOneriler((await res.json()).oneriler ?? []);
    } catch {
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  async function devriKontrolEt(id: string) {
    setDevirDurumu((d) => ({ ...d, [id]: null }));
    try {
      const res = await fetch(`/api/admin/proposals/${id}`);
      const veri = await res.json().catch(() => ({}));
      setDevirDurumu((d) => ({ ...d, [id]: Boolean(veri.tamam) }));
      toast[veri.tamam ? "success" : "info"](
        veri.tamam
          ? "Devir tamamlanmış görünüyor."
          : "Depo henüz organizasyonda görünmüyor.",
      );
    } catch {
      toast.error("Kontrol edilemedi.");
      setDevirDurumu((d) => ({ ...d, [id]: false }));
    }
  }

  async function kararVer(id: string, onay: boolean, adminNote?: string) {
    setIslenen(id);
    try {
      const res = await fetch(`/api/admin/proposals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onay, adminNote, kaynak: onay ? kaynaklar[id] : undefined }),
      });
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof veri.error === "string" ? veri.error : "İşlem başarısız.");
        return;
      }
      toast.success(onay ? "Öneri onaylandı, atama oluşturuldu." : "Öneri reddedildi.");
      setRedEdilen(null);
      setRedNotu("");
      await getir();
    } catch {
      toast.error("İşlem başarısız. Bağlantınızı kontrol edin.");
    } finally {
      setIslenen(null);
    }
  }

  if (yukleniyor) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Yükleniyor…
      </div>
    );
  }

  if (hata) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-red-600" />
        <p className="mt-2 text-sm font-medium text-red-800">Öneriler yüklenemedi.</p>
        <button
          onClick={getir}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (oneriler.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
        <Inbox className="mx-auto h-7 w-7 text-slate-300" />
        <p className="mt-2 text-sm text-slate-500">Bekleyen proje önerisi yok.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {oneriler.map((o) => {
        const ad =
          [o.studentProfile.user.name, o.studentProfile.user.lastName].filter(Boolean).join(" ") ||
          o.studentProfile.user.email;
        const kaynak = kaynaklar[o.id] ?? o.kaynak;
        const bu = islenen === o.id;

        return (
          <li key={o.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-900">{o.title}</h2>
              <span className="text-xs text-slate-500">
                {ad} · {new Date(o.createdAt).toLocaleDateString("tr-TR")}
              </span>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {o.description}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <span className="font-medium text-slate-700">Hedefi:</span> {o.goals}
            </p>

            {o.technologies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {o.technologies.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs font-semibold text-slate-700">
                GitHub kaynağı
                <span className="ml-1.5 font-normal text-slate-500">
                  · stajyerin tercihi: {KAYNAK_ETIKETLERI[o.kaynak] ?? o.kaynak}
                </span>
              </p>

              <select
                value={kaynak}
                onChange={(e) => setKaynaklar((k) => ({ ...k, [o.id]: e.target.value }))}
                aria-label="GitHub kaynağı"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(KAYNAK_ETIKETLERI).map(([d, m]) => (
                  <option key={d} value={d}>
                    {m}
                  </option>
                ))}
              </select>

              {o.repoUrl && (
                <a
                  href={o.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
                >
                  <Github className="h-3.5 w-3.5" />
                  {o.repoUrl.replace(/^https:\/\/github\.com\//, "")}
                </a>
              )}

              {kaynak === "DEVRET" && (
                <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800">
                  {/* Transferi platform başlatamaz — yalnız tespit edebilir. */}
                  Devri stajyer kendisi yapmalı (Settings → Danger Zone → Transfer
                  ownership). Onaylamadan önce devrin tamamlandığını kontrol edin.
                  <button
                    type="button"
                    onClick={() => devriKontrolEt(o.id)}
                    className="ml-1.5 inline-flex items-center gap-1 font-semibold text-amber-900 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Kontrol et
                  </button>
                  {devirDurumu[o.id] === true && (
                    <span className="ml-1.5 font-semibold text-emerald-700">✓ devredilmiş</span>
                  )}
                  {devirDurumu[o.id] === false && (
                    <span className="ml-1.5 font-semibold text-red-700">henüz değil</span>
                  )}
                </div>
              )}

              {kaynak === "BAGLA" && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800">
                  Depo stajyerin hesabında kalacağı için webhook ve AI kod incelemesi
                  bu projede çalışmaz (#348 ile mümkün olacak).
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => kararVer(o.id, true)}
                disabled={bu}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
              >
                {bu ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Onayla ve ata
              </button>
              <button
                onClick={() => {
                  setRedEdilen(redEdilen === o.id ? null : o.id);
                  setRedNotu("");
                }}
                disabled={bu}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Reddet
              </button>
            </div>

            {redEdilen === o.id && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label htmlFor={`red-${o.id}`} className="text-xs font-medium text-slate-700">
                  Red gerekçesi (zorunlu) — stajyer bunu görecek
                </label>
                <textarea
                  id={`red-${o.id}`}
                  value={redNotu}
                  onChange={(e) => setRedNotu(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Örn: Kapsam bir staj dönemi için fazla geniş; daraltıp tekrar önerebilirsin."
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setRedEdilen(null)}
                    className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={() => kararVer(o.id, false, redNotu)}
                    disabled={bu || redNotu.trim().length === 0}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:bg-slate-300"
                  >
                    Reddet
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
