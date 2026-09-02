"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { useCanliAkis } from "@/features/messaging/ui/useCanliAkis";

/**
 * Bildirim zili (#380).
 *
 * ⚠️ SAYAÇ MEVCUT TİKTEN BESLENİYOR, YENİ ALTYAPI YOK (#354 deseni).
 * #329'un canlı akışı zaten her tikte bağlı kullanıcılar için sorgu atıyor;
 * bildirim sayacı oraya eklendi. Ayrı bir yoklama kurmak, #329'un "maliyet
 * kullanıcı sayısından bağımsız" kazanımını aşındırırdı.
 *
 * ⚠️ AKIŞ KOPUKSA LİSTE YİNE AÇILIR. Zile tıklamak her durumda sunucudan
 * çekiyor; SSE'yi kesen bir vekilin arkasında bildirimler görünmez olmamalı.
 */

type Bildirim = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function BildirimZili() {
  const [acik, setAcik] = useState(false);
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [okunmamis, setOkunmamis] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const kutuRef = useRef<HTMLDivElement>(null);

  const getir = useCallback(async () => {
    setYukleniyor(true);
    try {
      const res = await fetch("/api/bildirimler");
      if (!res.ok) return;
      const veri = await res.json();
      setBildirimler(veri.bildirimler ?? []);
      setOkunmamis(veri.okunmamis ?? 0);
    } catch {
      // Sessiz: zil kozmetik bir yüzey, hata göstermek paneli bozuk gösterirdi.
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  // #329 tiki bildirim sayacını da taşıyor.
  useCanliAkis(
    useCallback(
      (olay) => {
        if (olay.tip === "bildirim") setOkunmamis(olay.okunmamis);
      },
      [],
    ),
  );

  // Dışarı tıklayınca kapat.
  useEffect(() => {
    if (!acik) return;
    const kapat = (e: MouseEvent) => {
      if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener("mousedown", kapat);
    return () => document.removeEventListener("mousedown", kapat);
  }, [acik]);

  async function ac() {
    const yeniDurum = !acik;
    setAcik(yeniDurum);
    if (!yeniDurum) return;

    await getir();
    // Açmak okundu saymak demek: kullanıcı listeyi gördü.
    if (okunmamis > 0) {
      setOkunmamis(0);
      fetch("/api/bildirimler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => {
        // Başarısız olursa sayaç bir sonraki tikte geri gelir.
      });
    }
  }

  return (
    <div className="relative" ref={kutuRef}>
      <button
        type="button"
        onClick={ac}
        aria-label={okunmamis > 0 ? `Bildirimler (${okunmamis} okunmamış)` : "Bildirimler"}
        className="relative inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        <Bell className="h-4 w-4" />
        {okunmamis > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {okunmamis > 9 ? "9+" : okunmamis}
          </span>
        )}
      </button>

      {acik && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">
            Bildirimler
          </div>

          <div className="max-h-96 overflow-y-auto">
            {yukleniyor ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Yükleniyor…
              </div>
            ) : bildirimler.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                Henüz bildiriminiz yok.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {bildirimler.map((b) => {
                  const icerik = (
                    <>
                      <p className="text-sm font-medium text-slate-900">{b.title}</p>
                      <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-slate-600">
                        {b.body}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(b.createdAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </>
                  );
                  return (
                    <li key={b.id} className={b.readAt ? "" : "bg-blue-50/40"}>
                      {b.link ? (
                        <Link
                          href={b.link}
                          onClick={() => setAcik(false)}
                          className="block px-4 py-3 hover:bg-slate-50"
                        >
                          {icerik}
                        </Link>
                      ) : (
                        <div className="px-4 py-3">{icerik}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
