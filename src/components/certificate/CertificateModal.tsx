"use client";

import { useState } from "react";
import {
  Award,
  Sparkles,
  ShieldCheck,
  Printer,
  X,
  GraduationCap,
  CheckCircle2,
  Quote,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { CertificateData } from "@/features/certificate/server/certificate";

type CertificateModalProps = {
  certificate: CertificateData;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onSave?: (data: { mentorNote: string; completionGrade: string }) => Promise<void>;
};

export function CertificateModal({
  certificate,
  isOpen,
  onClose,
  isAdmin = false,
  onSave,
}: CertificateModalProps) {
  const [mentorNote, setMentorNote] = useState(
    certificate.mentorNote ||
      `${certificate.studentName}, staj programı boyunca gösterdiği üstün problem çözme yeteneği, disiplin ve teknik yetkinlik ile projelerini başarıyla tamamlamıştır. Kendisini tebrik eder, profesyonel kariyerinde başarılar dileriz.`,
  );
  const [completionGrade, setCompletionGrade] = useState(
    certificate.completionGrade || "Üstün Başarı",
  );
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveDetails = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ mentorNote, completionGrade });
      toast.success("Sertifika ve referans notu başarıyla güncellendi.");
    } catch {
      toast.error("Kaydedilirken bir sorun oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = new Date(certificate.issuedAt).toLocaleDateString(
    "tr-TR",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 print:my-0 print:border-none print:shadow-none print:w-full print:max-w-none">
        
        {/* Üst Eylem Araç Çubuğu (Yazdırmada gizlenir) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Posinowa Staj Başarı Sertifikası
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seri No: <span className="font-mono font-semibold">{certificate.certificateNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && onSave && (
              <button
                onClick={handleSaveDetails}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Değişiklikleri Kaydet
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              PDF İndir / Yazdır
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admin Düzenleme Paneli (Opsiyonel) */}
        {isAdmin && onSave && (
          <div className="px-6 py-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 text-xs print:hidden space-y-3">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block font-bold text-amber-900 dark:text-amber-200 mb-1">
                  Başarı Derecesi
                </label>
                <select
                  value={completionGrade}
                  onChange={(e) => setCompletionGrade(e.target.value)}
                  className="w-full rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Üstün Başarı">🎖️ Üstün Başarı (High Honors)</option>
                  <option value="Onur Derecesi">🌟 Onur Derecesi (Honors)</option>
                  <option value="Başarılı">✅ Başarılı (Successful)</option>
                </select>
              </div>
              <div className="flex-[2]">
                <label className="block font-bold text-amber-900 dark:text-amber-200 mb-1">
                  Mentör / Yönetici Referans ve Bitirme Görüşü
                </label>
                <textarea
                  rows={2}
                  value={mentorNote}
                  onChange={(e) => setMentorNote(e.target.value)}
                  placeholder="Stajyerin teknik performansı ve çalışma disiplini hakkında referans notu..."
                  className="w-full rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 📜 SERTİFİKA GÖVDESİ (A4 Baskı ve İndirme İçin Özel Düzen) */}
        <div className="p-8 sm:p-12 print:p-8 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 print:bg-white text-slate-800 dark:text-slate-100 print:text-black relative">
          
          {/* Çerçeve & Güvenlik Deseni */}
          <div className="border-[6px] border-double border-indigo-900/30 dark:border-indigo-400/30 print:border-indigo-900 p-8 sm:p-10 rounded-2xl relative bg-white/60 dark:bg-slate-900/60 print:bg-white">
            
            {/* Köşe Süsleri */}
            <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-indigo-600/60" />
            <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-indigo-600/60" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-indigo-600/60" />
            <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-indigo-600/60" />

            {/* Üst Logo & Başlık */}
            <div className="text-center space-y-2 mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-emerald-500 text-white shadow-xl mb-1 p-0.5">
                <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-amber-400" />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-extrabold text-[11px] uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" /> Posinowa Teknoloji & Yazılım Akademisi
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 print:text-black font-serif pt-1">
                STAJ BAŞARI SERTİFİKASI
              </h1>
              <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-slate-600 font-semibold">
                Certificate of Internship Completion & Excellence
              </p>
            </div>

            {/* Sertifika Açıklama ve Öğrenci Adı */}
            <div className="text-center space-y-4 max-w-2xl mx-auto my-6">
              <p className="text-sm text-slate-600 dark:text-slate-300 print:text-slate-700">
                Bu resmi belge, aşağıda adı geçen stajyerin Posinowa bünyesinde yürütülen yazılım geliştirme ve yapay zeka mühendisliği staj programını başarıyla tamamladığını onaylar:
              </p>

              <div className="py-2 border-b-2 border-slate-300 dark:border-slate-700 inline-block px-8">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo-950 dark:text-indigo-200 print:text-indigo-900 font-serif">
                  {certificate.studentName}
                </h2>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-bold text-xs">
                <Award className="w-4 h-4 text-purple-600" />
                Başarı Derecesi: <span className="font-extrabold">{completionGrade}</span>
              </div>
            </div>

            {/* Tamamlanan Projeler Listesi */}
            {certificate.completedProjects.length > 0 && (
              <div className="my-6 p-4 rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Staj Sürecinde Geliştirilen ve Tamamlanan Projeler:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {certificate.completedProjects.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 font-medium flex items-center justify-between"
                    >
                      <span className="truncate text-slate-800 dark:text-slate-200">{p.title}</span>
                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {p.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mentör / Yönetici Referans Notu */}
            {mentorNote && (
              <div className="my-6 p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 relative">
                <Quote className="w-6 h-6 text-indigo-300 dark:text-indigo-700 absolute top-2 left-2 -z-0 opacity-50" />
                <p className="text-xs italic text-slate-700 dark:text-slate-300 leading-relaxed relative z-10 pl-5">
                  &ldquo;{mentorNote}&rdquo;
                </p>
                {certificate.mentorName && (
                  <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 text-right mt-1.5">
                    — {certificate.mentorName} (Teknik Mentör)
                  </p>
                )}
              </div>
            )}

            {/* Alt İmzalar & Mühür */}
            <div className="grid grid-cols-3 gap-4 items-end pt-8 mt-6 border-t border-slate-200 dark:border-slate-800 text-center">
              
              {/* Mentör İmzası */}
              <div className="space-y-1">
                <div className="h-10 flex items-end justify-center">
                  <span className="font-serif italic text-sm text-slate-600 dark:text-slate-300 font-bold">
                    {certificate.mentorName || "Teknik Mentör"}
                  </span>
                </div>
                <div className="w-32 border-t border-slate-400 mx-auto" />
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Teknik Mentör</p>
                <p className="text-[10px] text-slate-500">Posinowa Yazılım</p>
              </div>

              {/* Ortada Posinowa Altın Mühür */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-600 p-1 shadow-lg flex items-center justify-center">
                  <div className="w-full h-full rounded-full border-2 border-dashed border-amber-900/40 flex flex-col items-center justify-center text-amber-950 font-bold">
                    <ShieldCheck className="w-6 h-6" />
                    <span className="text-[8px] uppercase tracking-tighter font-extrabold">RESMİ MÜHÜR</span>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-slate-500 mt-1.5">{formattedDate}</p>
              </div>

              {/* Yönetici İmzası */}
              <div className="space-y-1">
                <div className="h-10 flex items-end justify-center">
                  <span className="font-serif italic text-sm text-slate-600 dark:text-slate-300 font-bold">
                    Posinowa Yönetim Kurulu
                  </span>
                </div>
                <div className="w-32 border-t border-slate-400 mx-auto" />
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Yönetici / Direktör</p>
                <p className="text-[10px] text-slate-500">Posinowa Akademi</p>
              </div>
            </div>

            {/* Doğrulama & Seri No Alt Çizgisi */}
            <div className="mt-8 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-[10px] text-slate-400">
              <span>Sertifika No: <strong className="font-mono text-slate-600 dark:text-slate-300">{certificate.certificateNumber}</strong></span>
              <span>Doğrulama: <strong className="text-indigo-600 dark:text-indigo-400">{certificate.verificationUrl}</strong></span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
