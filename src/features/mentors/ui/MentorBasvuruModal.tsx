"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Github, Linkedin, Sparkles } from "lucide-react";
import { ilgiEtiketi, MENTOR_KIDEMLERI } from "@/features/student/models/secenekler";

/**
 * #287: Admin'in bir mentörün başvuru cevaplarını okuduğu pencere.
 *
 * Onay kararı önceden yalnızca ad-soyada bakılarak veriliyordu. Cevaplar
 * lazy çekiliyor: admin panelinde onlarca mentör var, hepsinin serbest metin
 * cevaplarını baştan yüklemenin anlamı yok.
 */

type MentorBasvurusu = {
  title: string;
  company: string | null;
  yearsExperience: number;
  seniority: string;
  expertise: string[];
  capacity: number;
  weeklyHours: number;
  motivation: string;
  mentoringStyle: string;
  githubUrl: string | null;
  linkedinUrl: string | null;
  city: string | null;
  updatedAt: string;
  // #288: Analiz başvuruyla AYNI yanıtta geliyor; admin ikisini birlikte istiyor.
  analysis: MentorAnalizi | null;
};

type MentorAnalizi = {
  level: string;
  summary: string;
  strengths: string[];
  technicalTracks: string[];
  idealStudentProfile: string;
  matchingNotes: string[];
};

const kidemEtiketi = (deger: string) =>
  MENTOR_KIDEMLERI.find((k) => k.deger === deger)?.etiket ?? deger;

function Satir({ etiket, children }: { etiket: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {etiket}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

/**
 * #288: Eşleştirme değerlendirmesi.
 *
 * Cevapların ÜSTÜNDE duruyor: admin onay ekranında önce hızlı bir bakış
 * istiyor, serbest metinleri okumak ikinci adım.
 */
/**
 * Analiz yokken gösterilen açıklama (#352).
 *
 * Boş bırakmak yanlış olurdu: admin, değerlendirmenin neden görünmediğini
 * bilmeden bunu bir arıza sanar ve onay kararını eksik bilgiyle verir.
 * Rıza yokluğu bir HATA DEĞİL — mentörün meşru tercihi.
 */
function AnalizYok({ rizaVar }: { rizaVar: boolean }) {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-700">
        AI eşleştirme değerlendirmesi yok
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {rizaVar
          ? "Değerlendirme henüz üretilmedi. Mentör başvurusunu güncellediğinde oluşacaktır."
          : "Mentör, verilerinin yapay zekâ ile işlenmesine onay vermediği için değerlendirme üretilmedi. Onay vermek mentörün tercihidir; başvuru bundan bağımsız değerlendirilebilir."}
      </p>
    </div>
  );
}

function AnalizBolumu({ analiz }: { analiz: MentorAnalizi }) {
  return (
    <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        <h3 className="text-sm font-bold text-indigo-900">AI eşleştirme değerlendirmesi</h3>
        <span className="ml-auto rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-indigo-700">
          {analiz.level}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700">{analiz.summary}</p>

      {analiz.technicalTracks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {analiz.technicalTracks.map((t) => (
            <span key={t} className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-indigo-700">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Hangi stajyere uygun
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{analiz.idealStudentProfile}</p>
      </div>

      {analiz.strengths.length > 0 || analiz.matchingNotes.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {analiz.strengths.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Güçlü yönler</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {analiz.strengths.map((g) => (
                  <li key={g}>· {g}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {analiz.matchingNotes.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Eşleştirme notları</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {analiz.matchingNotes.map((n) => (
                  <li key={n}>· {n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MentorBasvuruModal({
  mentorId,
  mentorAdi,
  onClose,
}: {
  mentorId: string;
  mentorAdi: string;
  onClose: () => void;
}) {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [basvuru, setBasvuru] = useState<MentorBasvurusu | null>(null);
  // #352: Analizin yokluğunun iki sebebi olabilir; admin hangisi olduğunu
  // görmeden boş kartı arıza sanar.
  const [aiRizasiVar, setAiRizasiVar] = useState(true);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/mentors/${mentorId}/profile`);
        const veri = await res.json();
        if (iptal) return;
        if (!res.ok) {
          setHata(veri?.error ?? "Başvuru yüklenemedi.");
        } else {
          setBasvuru(veri.profile);
          setAiRizasiVar(veri.aiRizasiVar !== false);
        }
      } catch {
        if (!iptal) setHata("Başvuru yüklenemedi.");
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    })();
    return () => {
      iptal = true;
    };
  }, [mentorId]);

  // Esc ile kapanma: pencere klavyeyle de terk edilebilmeli.
  useEffect(() => {
    const dinle = (o: KeyboardEvent) => {
      if (o.key === "Escape") onClose();
    };
    window.addEventListener("keydown", dinle);
    return () => window.removeEventListener("keydown", dinle);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mentor-basvuru-basligi"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <h2 id="mentor-basvuru-basligi" className="text-lg font-bold text-slate-900">
              {mentorAdi}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Mentör başvuru cevapları</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {yukleniyor ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Başvuru yükleniyor...
            </div>
          ) : hata ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {hata}
            </p>
          ) : !basvuru ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Sorular henüz cevaplanmadı</p>
              <p className="mt-1 text-xs text-amber-800/80">
                Bu mentör başvuru formunu doldurmamış. Değerlendirme için cevapları beklemek gerekir.
              </p>
            </div>
          ) : (
            <>
              {basvuru.analysis ? (
                <AnalizBolumu analiz={basvuru.analysis} />
              ) : (
                <AnalizYok rizaVar={aiRizasiVar} />
              )}
            <dl>
              <Satir etiket="Ünvan">
                {basvuru.title}
                {basvuru.company ? (
                  <span className="text-slate-500"> · {basvuru.company}</span>
                ) : null}
              </Satir>
              <Satir etiket="Kıdem">
                {kidemEtiketi(basvuru.seniority)} · {basvuru.yearsExperience} yıl
              </Satir>
              <Satir etiket="Uzmanlık">
                <div className="flex flex-wrap gap-1.5">
                  {basvuru.expertise.map((u) => (
                    <span
                      key={u}
                      className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                    >
                      {ilgiEtiketi(u)}
                    </span>
                  ))}
                </div>
              </Satir>
              <Satir etiket="Kapasite">
                Aynı anda {basvuru.capacity} stajyer · haftada {basvuru.weeklyHours} saat
              </Satir>
              {basvuru.city ? <Satir etiket="Şehir">{basvuru.city}</Satir> : null}
              <Satir etiket="Neden mentörlük">
                <p className="whitespace-pre-wrap leading-relaxed">{basvuru.motivation}</p>
              </Satir>
              <Satir etiket="Mentörlük tarzı">
                <p className="whitespace-pre-wrap leading-relaxed">{basvuru.mentoringStyle}</p>
              </Satir>
              {basvuru.githubUrl || basvuru.linkedinUrl ? (
                <Satir etiket="Bağlantılar">
                  <div className="flex flex-wrap gap-3">
                    {basvuru.githubUrl ? (
                      <a
                        href={basvuru.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                      >
                        <Github className="h-4 w-4" /> GitHub
                      </a>
                    ) : null}
                    {basvuru.linkedinUrl ? (
                      <a
                        href={basvuru.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                      >
                        <Linkedin className="h-4 w-4" /> LinkedIn
                      </a>
                    ) : null}
                  </div>
                </Satir>
              ) : null}
            </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
