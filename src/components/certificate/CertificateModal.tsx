"use client";

import { useState } from "react";
import { SertifikaGovdesi } from "@/components/certificate/SertifikaGovdesi";
import { Award, Printer, X, Save, Loader2, Edit3, Eye, Download, Linkedin } from "lucide-react";
import { toast } from "sonner";
import type { CertificateData } from "@/features/certificate/server/certificate";
import { linkedInEkleUrl } from "@/features/certificate/paylasim";
import { tarihUzunBicimle } from "@/lib/tarih";

type CertificateModalProps = {
  certificate: CertificateData;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onSave?: (data: { mentorNote: string; completionGrade: string }) => Promise<void>;
};

/**
 * #235: Sayfadaki tum stil kurallarini METIN olarak toplar.
 *
 * Neden `<link rel="stylesheet">` etiketini kopyalamiyoruz: indirilen dosya
 * diske kaydedilip acildiginda `/_next/static/css/...` yolu `file:///_next/...`
 * olarak cozulur, hicbir stil yuklenmez ve sertifika ciplak HTML olarak gorunur.
 * Ayni sekilde yazdirma cercevesinde de ag beklemesi gerekmez.
 *
 * Ayni kaynakli stil sayfalarinin `cssRules` erisimi acik; farkli kaynakli
 * olanlar (varsa) sessizce atlanir.
 */
function stilKurallariniTopla(): string {
  let css = "";
  for (const sayfa of Array.from(document.styleSheets)) {
    try {
      for (const kural of Array.from(sayfa.cssRules)) {
        css += kural.cssText + "\n";
      }
    } catch {
      // farkli kaynakli stil sayfasi — okunamaz, atla
    }
  }
  return css;
}

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
    certificate.completionGrade || "",
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
      // #235: 0x0 iframe kullanma. Tarayicilarin bir kismi sifir boyutlu
      // iframe'in icerigine layout uygulamaz ve print() bos sayfa uretir.
      // Gercek A4 olcusu verip cerceveyi ekranin disina aliyoruz.
      iframe.style.cssText =
        "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      // Ana sayfadaki tüm Tailwind ve font stillerini iframe'e kopyala
      const stylesHtml = `<style>${stilKurallariniTopla()}</style>`;

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

      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        window.print();
        return;
      }

      const temizle = () => iframe.remove();

      const yazdir = async () => {
        // #235: Temizligi EN BASTA kaydet. Asagidaki bekleme ne olursa olsun
        // (fonts API takilsa, hata atsa) cerceve DOM'da unutulmaz.
        // iframe 1sn sonra degil, yazdirma bitince kaldirilir — diyalog
        // acikken DOM'dan cikarilirsa cikti bozulur.
        win.addEventListener("afterprint", temizle, { once: true });
        // afterprint her tarayicida tetiklenmiyor → guvenlik agi
        setTimeout(temizle, 120_000);

        // #235: Sabit 250ms gecikme yerine gercek hazir olma sinyali.
        // Kopyalanan <link rel=stylesheet> ve yazi tipleri inmeden print()
        // cagrilirsa cikti bicimsiz ya da bos olur. Bekleme SINIRLI: yazi
        // tipleri hic gelmezse yazdirmayi sonsuza kadar engellemesin.
        try {
          await Promise.race([
            doc.fonts?.ready ?? Promise.resolve(),
            new Promise((r) => setTimeout(r, 2_000)),
          ]);
        } catch {
          // fonts API yoksa/basarisizsa yazdirmaya yine de devam et
        }

        win.focus();
        win.print();
      };

      if (doc.readyState === "complete") {
        void yazdir();
      } else {
        win.addEventListener("load", () => void yazdir(), { once: true });
      }
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
      const stylesHtml = `<style>${stilKurallariniTopla()}</style>`;

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

  // #460: Public doğrulama sayfası (sunucu) ile AYNI biçimlendiriciden geçer;
  // aksi halde aynı belge iki yüzeyde farklı tarih gösterebilirdi.
  const formattedDate = certificate.issuedAt
    ? tarihUzunBicimle(certificate.issuedAt)
    : tarihUzunBicimle(new Date());

  return (
    <div
      id="certificate-modal-portal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-start justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto"
    >
      {/* #280: Modal ekran okuyucuya modal olarak duyurulmuyordu — role,
          aria-modal ve başlık bağlantısı yoktu. */}
      <div
        id="certificate-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-modal-title"
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:my-0 print:border-none print:shadow-none print:w-full print:max-w-none print:static print:overflow-visible"
      >
        
        {/* Üst Eylem Araç Çubuğu (Yazdırmada gizlenir) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/90 print:hidden">
          
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h3 id="certificate-modal-title" className="text-sm font-bold text-slate-900">
                Posinowa Staj Başarı Sertifikası
              </h3>
              <p className="text-xs text-slate-500">
                Seri No: <span className="font-mono font-semibold">{certificate.certificateNumber}</span>
              </p>
            </div>
          </div>

          {/* Sekme ve Eylem Butonları */}
          <div className="flex items-center gap-2">
            {isAdmin && onSave && (
              <div className="flex rounded-xl bg-slate-200/80 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "preview"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
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
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  Belgeyi Düzenle
                </button>
              </div>
            )}

            {/* 📥 Doğrudan Dosya İndirme Butonu */}
            <button
              type="button"
              onClick={handleDownloadDocument}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold shadow-sm transition"
              title="Sertifikayı doğrudan bağımsız dosya olarak indir"
            >
              <Download className="w-4 h-4 text-indigo-600" />
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

            {/* #323: LinkedIn "Add to Profile".
                Bu bir API DEĞİL, parametreli bir URL — token/izin gerekmiyor.
                LinkedIn'in sertifika formu alanlar dolu olarak açılıyor.

                YALNIZ RESMİ belgede gösteriliyor: `isIssued` false ise seri no
                ve doğrulama adresi henüz ÖNİZLEME'dir (kayıtlı değil). Onu
                LinkedIn'e işlemek, doğrulama sayfasının "bulunamadı" dediği
                bir kayıt üretirdi (#208 sözleşmesi). */}
            {certificate.isIssued && (
              <a
                href={linkedInEkleUrl({
                  certificateNumber: certificate.certificateNumber,
                  issuedAt: certificate.issuedAt,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold shadow-sm transition"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn Profilime Ekle
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ✏️ BELGEYİ DÜZENLE BÖLGESİ (Admin Ayrı Düzenleme Paneli) */}
        {isAdmin && onSave && activeTab === "edit" && (
          <div className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-200/80 print:hidden space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  Sertifika ve Mentör Görüşü Düzenleme
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Öğrencinin resmi belgesinde yer alacak başarı derecesi ve mentör referans notunu buradan özelleştirebilirsiniz.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Başarı Derecesi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Başarı Derecesi
                </label>
                <select
                  value={completionGrade}
                  onChange={(e) => setCompletionGrade(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Belirlenmedi (Seçilmedi)</option>
                  <option value="Üstün Başarı">🎖️ Üstün Başarı (High Honors)</option>
                  <option value="Onur Derecesi">🌟 Onur Derecesi (Honors)</option>
                  <option value="Yüksek Başarı">🚀 Yüksek Başarı (Excellence)</option>
                  <option value="Başarılı">✅ Başarılı (Successful)</option>
                </select>
              </div>

              {/* Öğrenci Bilgi Özeti */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Belge Sahibi Stajyer
                </label>
                <div className="w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 text-xs font-semibold text-slate-800 flex items-center justify-between">
                  <span>{certificate.studentName}</span>
                  <span className="text-slate-400 text-[11px]">{certificate.studentEmail}</span>
                </div>
              </div>
            </div>

            {/* Mentör Referans ve Değerlendirme Notu */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
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
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring transition"
              />

              {/* Hızlı Şablon Butonları */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Hızlı Şablonlar:</span>
                {DEFAULT_NOTE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMentorNote(tmpl)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-200/60 hover:bg-indigo-50 hover:text-indigo-600 transition"
                  >
                    Şablon {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Kaydet ve Önizle Butonları */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                Vazgeç / Önizlemeye Dön
              </button>
              <button
                type="button"
                onClick={handleSaveDetails}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition disabled:opacity-50"
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

        <SertifikaGovdesi certificate={certificate} formattedDate={formattedDate} mentorNote={mentorNote} completionGrade={completionGrade} />

      </div>
    </div>
  );
}
