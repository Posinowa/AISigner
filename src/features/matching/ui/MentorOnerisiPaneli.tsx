"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertTriangle, Info, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Mentör önerisi paneli (#328).
 *
 * ⚠️ YÜZDE SKOR GÖSTERİLMİYOR — bilinçli. "%88 uyum", arkasında ölçülmüş bir
 * şey yokken kesinlik hissi verir ve admin'i gerekçeyi okumadan güvenmeye
 * iter. Bant + gerekçe gösteriliyor; okunması gereken şey gerekçe.
 *
 * Öneri hiçbir şeyi otomatik ATAMAZ: her satırdaki "Ata" düğmesi admin'in
 * mevcut atama akışını çağırır. Karar insanda kalır.
 */

type Uyum = "guclu" | "olasi" | "zayif";

export type Oneri = {
  mentorId: string;
  ad: string | null;
  soyad: string | null;
  email: string;
  uyum: Uyum;
  gerekce: string;
  cekince: string | null;
  zatenAtanmis: boolean;
};

type Sonuc = {
  oneriler: Oneri[];
  degerlendirilen: number;
  analiziOlmayan: number;
  rizasiOlmayan: number;
};

const UYUM_ETIKETI: Record<Uyum, { metin: string; sinif: string }> = {
  guclu: { metin: "Güçlü uyum", sinif: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  olasi: { metin: "Olası uyum", sinif: "bg-blue-50 text-blue-700 border-blue-200" },
  zayif: { metin: "Zayıf uyum", sinif: "bg-slate-100 text-slate-600 border-slate-200" },
};

type Props = {
  studentId: string;
  ogrenciAdi: string;
  /** Mevcut atama akışını çağırır — bu bileşen kendisi atama YAPMAZ. */
  onAta: (mentorId: string) => void | Promise<void>;
  atamaSuruyor: boolean;
};

export function MentorOnerisiPaneli({ studentId, ogrenciAdi, onAta, atamaSuruyor }: Props) {
  const [acik, setAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  async function oneriAl() {
    setAcik(true);
    setYukleniyor(true);
    setSonuc(null);
    try {
      const res = await fetch("/api/admin/match-mentors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const veri = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof veri.error === "string" ? veri.error : "Öneri alınamadı.");
        setAcik(false);
        return;
      }
      setSonuc(veri);
    } catch {
      toast.error("Öneri alınamadı. Bağlantınızı kontrol edin.");
      setAcik(false);
    } finally {
      setYukleniyor(false);
    }
  }

  /**
   * Atamayı üst akışa devreder ve satırı "Atanmış" olarak işaretler.
   *
   * İşaretleme burada yapılmalı: panel kendi verisini `onAta` sonrası yeniden
   * çekmiyor (yeniden çekmek yeni bir ÜCRETLİ AI çağrısı olurdu). İşaretlemeseydik
   * düğme "Ata" olarak kalır ve admin aynı mentörü atadığını fark etmeden ikinci
   * kez tıklardı.
   */
  async function ata(mentorId: string) {
    await onAta(mentorId);
    setSonuc((onceki) =>
      onceki
        ? {
            ...onceki,
            oneriler: onceki.oneriler.map((o) =>
              o.mentorId === mentorId ? { ...o, zatenAtanmis: true } : o,
            ),
          }
        : onceki,
    );
  }

  const elenen = (sonuc?.analiziOlmayan ?? 0) + (sonuc?.rizasiOlmayan ?? 0);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={oneriAl}
        disabled={yukleniyor}
        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60"
      >
        {yukleniyor ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {yukleniyor ? "Öneri hazırlanıyor…" : "AI mentör önerisi"}
      </button>

      {acik && sonuc && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">
              {ogrenciAdi} için öneriler
            </p>
            <button
              type="button"
              onClick={() => setAcik(false)}
              aria-label="Önerileri kapat"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {sonuc.oneriler.length === 0 ? (
            // Model bilerek boş dönebilir: "listeyi doldurmak için zayıf aday
            // önerme" talimatı var. Bu bir hata değil, bilgi.
            <p className="text-xs text-slate-500">
              Uygun bir eşleşme bulunamadı. Adaylar arasında bu stajyerin
              ihtiyaçlarıyla örtüşen bir mentör görülmedi.
            </p>
          ) : (
            <ul className="space-y-2">
              {sonuc.oneriler.map((o) => {
                const etiket = UYUM_ETIKETI[o.uyum];
                const ad = [o.ad, o.soyad].filter(Boolean).join(" ") || o.email;

                return (
                  <li key={o.mentorId} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800">{ad}</p>
                        <span
                          className={`mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${etiket.sinif}`}
                        >
                          {etiket.metin}
                        </span>
                      </div>

                      {o.zatenAtanmis ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <Check className="w-3 h-3" />
                          Atanmış
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => ata(o.mentorId)}
                          disabled={atamaSuruyor}
                          className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                        >
                          Ata
                        </button>
                      )}
                    </div>

                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{o.gerekce}</p>

                    {o.cekince && (
                      <p className="mt-1.5 flex gap-1.5 text-[11px] leading-relaxed text-amber-700">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        {o.cekince}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Şeffaflık: "en uygun 3" ifadesi, adayların yarısı elenmişken
              yanıltıcı olur. Admin neyin arasından seçildiğini bilmeli. */}
          <p className="mt-2 flex gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              {sonuc.degerlendirilen} mentör değerlendirildi
              {elenen > 0 && (
                <>
                  {" "}
                  · {sonuc.analiziOlmayan > 0 && `${sonuc.analiziOlmayan} mentör AI analizi olmadığı için`}
                  {sonuc.analiziOlmayan > 0 && sonuc.rizasiOlmayan > 0 && ", "}
                  {sonuc.rizasiOlmayan > 0 && `${sonuc.rizasiOlmayan} mentör yapay zekâ onayı olmadığı için`}
                  {" "}kapsam dışı
                </>
              )}
              . Öneri bir tavsiyedir; atama kararı sizindir.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
