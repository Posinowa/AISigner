"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2, Plus, Trash2, X } from "lucide-react";
import { tarihSaatBicimle } from "@/lib/tarih";

/**
 * Mentör ofis saati paneli (#398).
 *
 * ⚠️ Saatler UTC saklanıyor, burada KULLANICININ YEREL saatiyle gösteriliyor.
 * datetime-local girdisi de yerel; new Date(...) ile UTC ISO metnine
 * çevriliyor. Tarih kayması riski buradadır.
 */

type Slot = {
  id: string;
  baslangic: string;
  bitis: string;
  ogrenciNotu: string | null;
  mentorNotu: string | null;
  rezerveEden: { id: string; name: string | null; lastName: string | null; email: string } | null;
};

const saat = (s: string) =>
  tarihSaatBicimle(s, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function OfisSaatiMentor() {
  const [slotlar, setSlotlar] = useState<Slot[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(false);
  const [bas, setBas] = useState("");
  const [bit, setBit] = useState("");
  const [link, setLink] = useState("");
  const [islemde, setIslemde] = useState(false);

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const [slotRes, linkRes] = await Promise.all([
        fetch("/api/ofis-saati"),
        fetch("/api/mentor/gorusme-linki"),
      ]);
      if (!slotRes.ok) {
        setHata(true);
        return;
      }
      setSlotlar((await slotRes.json()).slotlar ?? []);
      if (linkRes.ok) setLink((await linkRes.json()).link ?? "");
    } catch {
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  async function ac() {
    setIslemde(true);
    try {
      const res = await fetch("/api/ofis-saati", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baslangic: new Date(bas).toISOString(),
          bitis: new Date(bit).toISOString(),
        }),
      });
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof veri.error === "string" ? veri.error : "Slot açılamadı.");
        return;
      }
      // count GERÇEKTEN oluşan sayı: zaten açık bir aralık yeniden açılırsa 0
      // döner ve "0 dilim açıldı" demek mentörü boşuna telaslandırır.
      toast.success(
        veri.olusturulan === 0
          ? "Bu aralık zaten açıktı, yeni dilim eklenmedi."
          : veri.olusturulan + " görüşme dilimi açıldı.",
      );
      setBas("");
      setBit("");
      await getir();
    } catch {
      toast.error("İşlem başarısız. Bağlantınızı kontrol edin.");
    } finally {
      setIslemde(false);
    }
  }

  async function linkKaydet() {
    const res = await fetch("/api/mentor/gorusme-linki", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link }),
    });
    const veri = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(
        typeof veri.error === "string" ? veri.error : "Geçerli bir http(s) adresi girin.",
      );
      return;
    }
    toast.success("Görüşme bağlantısı kaydedildi.");
  }

  /** Boş slot silinir, dolu slot yalnız rezervasyondan arındırılır. */
  async function sil(id: string, tamamen: boolean) {
    const res = await fetch("/api/ofis-saati/" + id + (tamamen ? "?tamamen=1" : ""), {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("İşlem başarısız.");
      return;
    }
    toast.success(tamamen ? "Slot silindi." : "Rezervasyon iptal edildi.");
    await getir();
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <CalendarClock className="h-4 w-4 text-blue-600" />
        Ofis Saati
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Müsait olduğun aralığı aç; sistem 20 dakikalık dilimlere böler ve
        stajyerler tek tıkla rezerve eder.
      </p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <label htmlFor="gorusme-linki" className="text-xs font-semibold text-slate-700">
          Görüşme bağlantın (Meet, Zoom…)
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="gorusme-linki"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://meet.google.com/..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={linkKaydet}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Kaydet
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Bağlantıyı stajyer yalnızca rezervasyon sonrası görür.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="slot-bas" className="text-xs font-medium text-slate-700">
            Başlangıç
          </label>
          <input
            id="slot-bas"
            type="datetime-local"
            value={bas}
            onChange={(e) => setBas(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="slot-bit" className="text-xs font-medium text-slate-700">
            Bitiş
          </label>
          <input
            id="slot-bit"
            type="datetime-local"
            value={bit}
            onChange={(e) => setBit(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={ac}
          disabled={!bas || !bit || islemde}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
        >
          {islemde ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Aralık aç
        </button>
      </div>

      <div className="mt-4">
        {yukleniyor ? (
          <p className="py-6 text-center text-sm text-slate-500">Yükleniyor…</p>
        ) : hata ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-medium text-red-800">Takvim yüklenemedi.</p>
            <button onClick={getir} className="mt-2 text-sm font-medium text-red-700 underline">
              Tekrar dene
            </button>
          </div>
        ) : slotlar.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Henüz açılmış bir görüşme dilimin yok.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {slotlar.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{saat(s.baslangic)}</p>
                  {s.rezerveEden ? (
                    <p className="text-xs text-slate-600">
                      {[s.rezerveEden.name, s.rezerveEden.lastName].filter(Boolean).join(" ") ||
                        s.rezerveEden.email}
                      {s.ogrenciNotu ? " - " + s.ogrenciNotu : ""}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-emerald-700">Boş</p>
                  )}
                </div>
                <button
                  onClick={() => sil(s.id, !s.rezerveEden)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {s.rezerveEden ? (
                    <>
                      <X className="h-3 w-3" /> Rezervasyonu iptal et
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3" /> Sil
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
