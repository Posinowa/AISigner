"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2, Video, X } from "lucide-react";
import { tarihBicimle, saatBicimle } from "@/lib/tarih";

/**
 * Stajyer ofis saati görünümü (#398).
 *
 * Sunucu yalnızca BU stajyerin görebileceği slotları dönüyor: kendi
 * mentörlerinin boş slotları + kendi rezervasyonları. Başkasının
 * rezervasyonu istemciye hiç gelmiyor.
 */

type Slot = {
  id: string;
  baslangic: string;
  bitis: string;
  rezerveEdenId: string | null;
  mentor: {
    id: string;
    name: string | null;
    lastName: string | null;
    mentorProfile: { gorusmeLinki: string | null } | null;
  };
};

// #460: Panodaki hatırlatma (`YaklasanGorusme`) SUNUCUDA render ediliyor;
// aynı slot için iki yüzeyin aynı saati basması bu ortak biçimlendiriciye
// bağlı. Öncesinde pano 11:00, bu sayfa 14:00 gösteriyordu.
const gun = (s: string) =>
  tarihBicimle(s, { weekday: "long", day: "numeric", month: "long" });

const saat = (s: string) => saatBicimle(s);

export function OfisSaatiOgrenci({ kullaniciId }: { kullaniciId: string }) {
  const [slotlar, setSlotlar] = useState<Slot[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(false);
  const [acik, setAcik] = useState<string | null>(null);
  const [not, setNot] = useState("");
  const [islenen, setIslenen] = useState<string | null>(null);

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const res = await fetch("/api/ofis-saati");
      if (!res.ok) {
        setHata(true);
        return;
      }
      setSlotlar((await res.json()).slotlar ?? []);
    } catch {
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  async function rezerveEt(id: string) {
    setIslenen(id);
    try {
      const res = await fetch("/api/ofis-saati/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not: not.trim() || undefined }),
      });
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof veri.error === "string" ? veri.error : "Rezervasyon yapılamadı.");
        // Slot başkasına gitmiş olabilir; listeyi tazele.
        await getir();
        return;
      }
      toast.success("Görüşme ayarlandı.");
      setAcik(null);
      setNot("");
      await getir();
    } catch {
      toast.error("İşlem başarısız. Bağlantınızı kontrol edin.");
    } finally {
      setIslenen(null);
    }
  }

  async function iptalEt(id: string) {
    setIslenen(id);
    try {
      const res = await fetch("/api/ofis-saati/" + id, { method: "DELETE" });
      if (!res.ok) {
        toast.error("İptal edilemedi.");
        return;
      }
      toast.success("Rezervasyon iptal edildi.");
      await getir();
    } finally {
      setIslenen(null);
    }
  }

  const benimkiler = slotlar.filter((s) => s.rezerveEdenId === kullaniciId);
  const bos = slotlar.filter((s) => s.rezerveEdenId === null);

  const mentorAdi = (s: Slot) =>
    [s.mentor.name, s.mentor.lastName].filter(Boolean).join(" ") || "Mentörün";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <CalendarClock className="h-4 w-4 text-blue-600" />
        Mentör Görüşmesi
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Mentörünün açık bıraktığı 20 dakikalık dilimlerden birini seç.
      </p>

      {yukleniyor ? (
        <p className="py-6 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : hata ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm font-medium text-red-800">Takvim yüklenemedi.</p>
          <button onClick={getir} className="mt-2 text-sm font-medium text-red-700 underline">
            Tekrar dene
          </button>
        </div>
      ) : (
        <>
          {benimkiler.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Yaklaşan görüşmelerin
              </h3>
              {benimkiler.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {gun(s.baslangic)} · {saat(s.baslangic)}-{saat(s.bitis)}
                    </p>
                    <p className="text-xs text-slate-600">{mentorAdi(s)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.mentor.mentorProfile?.gorusmeLinki && (
                      <a
                        href={s.mentor.mentorProfile.gorusmeLinki}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <Video className="h-3.5 w-3.5" />
                        Katıl
                      </a>
                    )}
                    <button
                      onClick={() => iptalEt(s.id)}
                      disabled={islenen === s.id}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                      İptal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Müsait dilimler
            </h3>
            {bos.length === 0 ? (
              <p className="py-5 text-center text-sm text-slate-500">
                Mentörün şu an açık bir görüşme dilimi bırakmamış.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {bos.map((s) => (
                  <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {gun(s.baslangic)} · {saat(s.baslangic)}-{saat(s.bitis)}
                        </p>
                        <p className="text-xs text-slate-500">{mentorAdi(s)}</p>
                      </div>
                      <button
                        onClick={() => {
                          setAcik(acik === s.id ? null : s.id);
                          setNot("");
                        }}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Rezerve et
                      </button>
                    </div>

                    {acik === s.id && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <label htmlFor={"not-" + s.id} className="text-xs font-medium text-slate-700">
                          Ne konuşmak istiyorsun? (isteğe bağlı)
                        </label>
                        <textarea
                          id={"not-" + s.id}
                          value={not}
                          onChange={(e) => setNot(e.target.value)}
                          rows={2}
                          maxLength={500}
                          placeholder="Örn: Üçüncü adımda kimlik doğrulamasında takıldım."
                          className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Mentörün bunu görüşmeden önce okur.
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            onClick={() => setAcik(null)}
                            className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            Vazgeç
                          </button>
                          <button
                            onClick={() => rezerveEt(s.id)}
                            disabled={islenen === s.id}
                            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
                          >
                            {islenen === s.id && <Loader2 className="h-3 w-3 animate-spin" />}
                            Onayla
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
