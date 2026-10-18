"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Loader2, AlertTriangle } from "lucide-react";

/**
 * Takım yönetimi (#332 Faz 2).
 *
 * ⚠️ AYRILAN ÜYE LİSTEDEN KAYBOLMAZ, "ayrıldı" olarak görünür. Katkı geçmişi
 * bireysel sertifikanın dayanağı olduğu için üyelik kaydı silinmiyor; admin'in
 * de kimin ne zaman ayrıldığını görebilmesi gerekiyor.
 */

import { type Takim, type Secenek, TakimKarti } from "@/features/teams/ui/TakimYonetimiParcalari";

export function TakimYonetimi() {
  const [takimlar, setTakimlar] = useState<Takim[]>([]);
  const [ogrenciler, setOgrenciler] = useState<Secenek[]>([]);
  const [mentorler, setMentorler] = useState<Secenek[]>([]);
  const [sablonlar, setSablonlar] = useState<{ id: string; title: string }[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  // #159 deseni: boş liste ile hata AYRI gösterilir.
  const [hata, setHata] = useState(false);
  const [islem, setIslem] = useState(false);
  const [yeniAd, setYeniAd] = useState("");

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const [t, u, m, p] = await Promise.all([
        fetch("/api/admin/teams"),
        /*
         * ⚠️ KATEGORİ SUNUCUDA. Liste artık sayfalı; `role === "STUDENT"`
         * süzgecini istemcide çalıştırmak yalnız İLK SAYFAYI süzer ve üye
         * seçici stajyerlerin çoğunu sessizce göstermezdi.
         *
         * Seçici tüm stajyerleri bir arada istiyor (arama kutusu yok),
         * bu yüzden tavan yüksek: `limit=200` sunucunun kabul ettiği azami
         * değer. Bunun da yetmediği ölçekte seçicinin kendi araması olmalı.
         */
        fetch("/api/admin/users?kategori=STUDENT&limit=200"),
        fetch("/api/admin/mentors"),
        fetch("/api/admin/project-templates"),
      ]);
      if (!t.ok) {
        setHata(true);
        return;
      }
      setTakimlar((await t.json()).takimlar ?? []);

      if (u.ok) {
        const veri = await u.json();
        const liste = Array.isArray(veri) ? veri : (veri.users ?? []);
        // Süzme sunucuda yapıldı; burada tekrar elemek gereksiz.
        setOgrenciler(liste);
      }
      if (m.ok) setMentorler(await m.json());
      if (p.ok) {
        const veri = await p.json();
        setSablonlar(Array.isArray(veri) ? veri : (veri.templates ?? []));
      }
    } catch {
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  const cagir = useCallback(
    async (yol: string, secenekler: RequestInit, basari: string) => {
      setIslem(true);
      try {
        const res = await fetch(yol, {
          headers: { "Content-Type": "application/json" },
          ...secenekler,
        });
        const veri = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(typeof veri.error === "string" ? veri.error : "İşlem başarısız.");
          return false;
        }
        toast.success(basari);
        await getir();
        return true;
      } catch {
        toast.error("İşlem başarısız. Bağlantınızı kontrol edin.");
        return false;
      } finally {
        setIslem(false);
      }
    },
    [getir],
  );

  if (yukleniyor) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Takımlar yükleniyor…
      </div>
    );
  }

  if (hata) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-red-600" />
        <p className="mt-2 text-sm font-medium text-red-800">Takımlar yüklenemedi.</p>
        <button
          onClick={getir}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!yeniAd.trim()) return;
          const ok = await cagir(
            "/api/admin/teams",
            { method: "POST", body: JSON.stringify({ name: yeniAd }) },
            "Takım oluşturuldu.",
          );
          if (ok) setYeniAd("");
        }}
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
      >
        <label htmlFor="takim-adi" className="sr-only">
          Takım adı
        </label>
        <input
          id="takim-adi"
          value={yeniAd}
          onChange={(e) => setYeniAd(e.target.value)}
          placeholder="Yeni takım adı"
          maxLength={60}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={islem || yeniAd.trim().length < 2}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          Takım oluştur
        </button>
      </form>

      {takimlar.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
          <Users className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">Henüz takım yok.</p>
        </div>
      ) : (
        takimlar.map((t) => (
          <TakimKarti
            key={t.id}
            takim={t}
            ogrenciler={ogrenciler}
            mentorler={mentorler}
            sablonlar={sablonlar}
            islem={islem}
            cagir={cagir}
          />
        ))
      )}
    </div>
  );
}
