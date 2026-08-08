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
  Edit3,
  Eye,
  Download,
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

const DEFAULT_NOTE_TEMPLATES = [
  "Staj programı boyunca gösterdiği üstün problem çözme yeteneği, disiplin ve teknik yetkinlik ile projelerini başarıyla tamamlamıştır. Kendisini tebrik eder, profesyonel kariyerinde başarılar dileriz.",
  "Modern yazılım mimarisi, yapay zeka entegrasyonu ve takım çalışmasında sergilediği teknik vizyon ile staj dönemini üstün başarıyla tamamlamıştır.",
  "Görev aldığı tüm aşamalarda proaktif yaklaşımı, kod kalitesine verdiği önem ve hızlı öğrenme kabiliyeti ile ekibe değer katmıştır. Gelecekteki başarılarının devamını dileriz.",
];

export function CertificateModal({
  certificate,
  isOpen,
  onClose,
  isAdmin = false,
  onSave,
}: CertificateModalProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [mentorNote, setMentorNote] = useState(
    certificate.mentorNote || DEFAULT_NOTE_TEMPLATES[0],
  );
  const [completionGrade, setCompletionGrade] = useState(
    certificate.completionGrade || "Üstün Başarı",
  );
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    setActiveTab("preview");
    toast.info("Yazdırma penceresinde 'Hedef' olarak 'PDF olarak kaydet'i seçebilirsiniz.", {
      duration: 4000,
    });

    // İzole yazdırma: ana sayfa layout'undan tamamen bağımsız A4 iframe oluştur
    const printArea = document.getElementById("certificate-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      // Ana sayfadaki tüm Tailwind ve font stillerini iframe'e kopyala
      let stylesHtml = "";
      document.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
        stylesHtml += node.outerHTML;
      });

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="tr">
          <head>
            <meta charset="utf-8" />
            <title>Sertifika - ${certificate.studentName}</title>
            ${stylesHtml}
            <style>
              @page {
                size: A4 portrait;
                margin: 6mm;
              }
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body {
                background: #ffffff !important;
                color: #0f172a !important;
                margin: 0 !important;
                padding: 0 !important;
                font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
              }
              #certificate-print-area {
                padding: 4px !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                display: block !important;
                background: #ffffff !important;
              }
            </style>
          </head>
          <body>
            ${printArea.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    } catch (e) {
      console.error("Print error:", e);
      window.print();
    }
  };

  const handleDownloadDocument = () => {
    const printArea = document.getElementById("certificate-print-area");
    if (!printArea) {
      toast.error("Sertifika alanı bulunamadı.");
      return;
    }

    try {
      let stylesHtml = "";
      document.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
        stylesHtml += node.outerHTML;
      });

      const fullHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Posinowa Staj Başarı Sertifikası - ${certificate.studentName}</title>
  ${stylesHtml}
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      background: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 24px 12px;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }
    .cert-wrapper {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border-radius: 24px;
      overflow: hidden;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .cert-wrapper {
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="cert-wrapper">
    ${printArea.outerHTML}
  </div>
</body>
</html>`;

      const safeName = (certificate.studentName || "Stajyer")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/gi, "-");
      const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Posinowa-Sertifika-${safeName}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Sertifika belgesi başarıyla indirildi!");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("İndirme sırasında bir hata oluştu.");
    }
  };

  const handleSaveDetails = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ mentorNote, completionGrade });
      toast.success("Sertifika ve referans notu başarıyla güncellendi.");
      setActiveTab("preview");
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
    <div
      id="certificate-modal-portal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-start justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto"
    >
      <div
        id="certificate-modal-container"
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 print:my-0 print:border-none print:shadow-none print:w-full print:max-w-none print:static print:overflow-visible"
      >
        
        {/* Üst Eylem Araç Çubuğu (Yazdırmada gizlenir) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 print:hidden">
          
          <div className="flex items-center gap-3">
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

          {/* Sekme ve Eylem Butonları */}
          <div className="flex items-center gap-2">
            {isAdmin && onSave && (
              <div className="flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "preview"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Önizleme
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "edit"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Belgeyi Düzenle
                </button>
              </div>
            )}

            {/* 📥 Doğrudan Dosya İndirme Butonu */}
            <button
              type="button"
              onClick={handleDownloadDocument}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold shadow-sm transition"
              title="Sertifikayı doğrudan bağımsız dosya olarak indir"
            >
              <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Sertifikayı İndir
            </button>

            {/* 🖨️ PDF / Yazdır Butonu */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              PDF / Yazdır
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ✏️ BELGEYİ DÜZENLE BÖLGESİ (Admin Ayrı Düzenleme Paneli) */}
        {isAdmin && onSave && activeTab === "edit" && (
          <div className="p-6 sm:p-8 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800 print:hidden space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Sertifika ve Mentör Görüşü Düzenleme
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Öğrencinin resmi belgesinde yer alacak başarı derecesi ve mentör referans notunu buradan özelleştirebilirsiniz.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Başarı Derecesi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Başarı Derecesi
                </label>
                <select
                  value={completionGrade}
                  onChange={(e) => setCompletionGrade(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Üstün Başarı">🎖️ Üstün Başarı (High Honors)</option>
                  <option value="Onur Derecesi">🌟 Onur Derecesi (Honors)</option>
                  <option value="Yüksek Başarı">🚀 Yüksek Başarı (Excellence)</option>
                  <option value="Başarılı">✅ Başarılı (Successful)</option>
                </select>
              </div>

              {/* Öğrenci Bilgi Özeti */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Belge Sahibi Stajyer
                </label>
                <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>{certificate.studentName}</span>
                  <span className="text-slate-400 text-[11px]">{certificate.studentEmail}</span>
                </div>
              </div>
            </div>

            {/* Mentör Referans ve Değerlendirme Notu */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mentör / Yönetici Referans ve Bitirme Görüşü
                </label>
                <span className="text-[11px] text-slate-400">
                  {mentorNote.length} / 2000 karakter
                </span>
              </div>
              <textarea
                rows={3}
                value={mentorNote}
                onChange={(e) => setMentorNote(e.target.value)}
                placeholder="Stajyerin teknik performansı, problem çözme yeteneği ve katkıları hakkında referans mektubu..."
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-xs text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />

              {/* Hızlı Şablon Butonları */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Hızlı Şablonlar:</span>
                {DEFAULT_NOTE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMentorNote(tmpl)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-200/60 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-300 transition"
                  >
                    Şablon {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Kaydet ve Önizle Butonları */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Vazgeç / Önizlemeye Dön
              </button>
              <button
                type="button"
                onClick={handleSaveDetails}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Değişiklikleri Kaydet & Önizle
              </button>
            </div>
          </div>
        )}

        {/* 📜 SERTİFİKA GÖVDESİ (A4 Baskı ve İndirme İçin Kusursuz Hizalanmış Şablon) */}
        {/* #204: id → yazdırmada yalnız bu alan basılır (bkz. globals.css @media print). */}
        <div id="certificate-print-area" className="p-6 sm:p-12 print:p-6 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 print:bg-white text-slate-800 dark:text-slate-100 print:text-black relative">
          
          {/* Çerçeve & Güvenlik Deseni */}
          <div className="border-[6px] border-double border-indigo-900/30 dark:border-indigo-400/30 print:border-indigo-900 p-6 sm:p-10 rounded-2xl relative bg-white/80 dark:bg-slate-900/80 print:bg-white shadow-inner">
            
            {/* Köşe Süsleri */}
            <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-indigo-600/60" />
            <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-indigo-600/60" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-indigo-600/60" />
            <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-indigo-600/60" />

            {/* Üst Logo & Başlık */}
            <div className="text-center space-y-2 mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-emerald-500 text-white shadow-xl mb-1 p-0.5">
                <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-amber-400" />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-extrabold text-[11px] uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" /> Posinowa Teknoloji & Yazılım Akademisi
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 print:text-black font-serif pt-1">
                STAJ BAŞARI SERTİFİKASI
              </h1>
              <p className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-slate-600 font-semibold">
                Certificate of Internship Completion & Excellence
              </p>
            </div>

            {/* Sertifika Açıklama ve Öğrenci Adı */}
            <div className="text-center space-y-3 max-w-2xl mx-auto my-5">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 print:text-slate-700 leading-relaxed">
                Bu resmi belge, aşağıda adı geçen stajyerin Posinowa bünyesinde yürütülen yazılım geliştirme ve yapay zeka mühendisliği staj programını başarıyla tamamladığını onaylar:
              </p>

              <div className="py-2 border-b-2 border-slate-300 dark:border-slate-700 inline-block px-8">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-indigo-950 dark:text-indigo-200 print:text-indigo-900 font-serif">
                  {certificate.studentName}
                </h2>
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-bold text-xs">
                  <Award className="w-3.5 h-3.5 text-purple-600" />
                  Başarı Derecesi: <span className="font-extrabold">{completionGrade}</span>
                </span>
              </div>
            </div>

            {/* Tamamlanan Projeler Listesi */}
            {certificate.completedProjects.length > 0 && (
              <div className="my-5 p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Staj Sürecinde Geliştirilen ve Tamamlanan Projeler:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {certificate.completedProjects.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 font-medium flex items-center justify-between"
                    >
                      <span className="truncate text-slate-800 dark:text-slate-200 text-xs">{p.title}</span>
                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {p.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mentör / Yönetici Referans Notu (Kayma ve taşma önleyici simetrik yapı) */}
            {mentorNote && (
              <div className="my-5 p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 relative">
                <div className="flex items-start gap-2.5">
                  <Quote className="w-5 h-5 text-indigo-400 dark:text-indigo-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs italic text-slate-700 dark:text-slate-300 leading-relaxed font-serif">
                      &ldquo;{mentorNote}&rdquo;
                    </p>
                    {certificate.mentorName && (
                      <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 text-right mt-2">
                        — {certificate.mentorName} (Teknik Mentör)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alt İmzalar & Mühür (Simetrik 3 Sütunlu Grid) */}
            <div className="grid grid-cols-3 gap-4 items-end pt-6 mt-4 border-t border-slate-200 dark:border-slate-800 text-center">
              
              {/* Mentör İmzası */}
              <div className="space-y-1">
                <div className="h-8 flex items-end justify-center">
                  <span className="font-serif italic text-xs text-slate-700 dark:text-slate-300 font-bold">
                    {certificate.mentorName || "Teknik Mentör"}
                  </span>
                </div>
                <div className="w-28 border-t border-slate-400 mx-auto" />
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Teknik Mentör</p>
                <p className="text-[10px] text-slate-500">Posinowa Yazılım</p>
              </div>

              {/* Ortada Posinowa Altın Mühür */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-600 p-1 shadow-lg flex items-center justify-center">
                  <div className="w-full h-full rounded-full border-2 border-dashed border-amber-900/40 flex flex-col items-center justify-center text-amber-950 font-bold">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-[7px] uppercase tracking-tighter font-extrabold">MÜHÜR</span>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-slate-500 mt-1">{formattedDate}</p>
              </div>

              {/* Yönetici İmzası */}
              <div className="space-y-1">
                <div className="h-8 flex items-end justify-center">
                  <span className="font-serif italic text-xs text-slate-700 dark:text-slate-300 font-bold">
                    Posinowa Yönetim Kurulu
                  </span>
                </div>
                <div className="w-28 border-t border-slate-400 mx-auto" />
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Yönetici / Direktör</p>
                <p className="text-[10px] text-slate-500">Posinowa Akademi</p>
              </div>
            </div>

            {/* Doğrulama & Seri No Alt Çizgisi */}
            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-[10px] text-slate-400">
              <span>Sertifika No: <strong className="font-mono text-slate-600 dark:text-slate-300">{certificate.certificateNumber}</strong></span>
              <span>Doğrulama: <strong className="text-indigo-600 dark:text-indigo-400">{certificate.verificationUrl}</strong></span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
