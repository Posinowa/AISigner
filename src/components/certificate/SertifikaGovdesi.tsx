"use client";

import { Award, CheckCircle2, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { POSINOWA_LOGO_DATA_URI } from "@/features/certificate/ui/posinowa-logo";
import { SertifikaQr } from "@/features/certificate/ui/SertifikaQr";
import type { CertificateData } from "@/features/certificate/server/certificate";

export type SertifikaGovdesiProps = {
  certificate: CertificateData;
  formattedDate: string;
  mentorNote: string;
  completionGrade: string;
};

/** Sertifikanın A4 baskı ve indirme gövdesi (önizleme ve yazdırma tek kaynak). */
export function SertifikaGovdesi({
  certificate,
  formattedDate,
  mentorNote,
  completionGrade,
}: SertifikaGovdesiProps) {
  return (
    <>
    {/* 📜 SERTİFİKA GÖVDESİ (A4 Baskı ve İndirme İçin Kusursuz Hizalanmış Şablon) */}
    {/* #204: id → yazdırmada yalnız bu alan basılır (bkz. globals.css @media print). */}
    <div id="certificate-print-area" className="p-6 sm:p-12 print:p-6 bg-gradient-to-b from-slate-50 via-white to-slate-50 print:bg-white text-slate-800 print:text-black relative">
      
      {/* Çerçeve & Güvenlik Deseni */}
      <div className="border-[6px] border-double border-primary/30 print:border-primary p-6 sm:p-10 rounded-2xl relative bg-white/80 print:bg-white shadow-inner">
        
        {/* Köşe Süsleri */}
        <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-primary/60" />
        <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-primary/60" />
        <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-primary/60" />
        <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-primary/60" />

        {/* Üst Logo & Başlık */}
        <div className="text-center space-y-2 mb-6">
          {/* #280: Jenerik ikon yerine gerçek Posinowa logosu. Gömülü
              data URI — indirilen HTML dosyasında da görünsün. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={POSINOWA_LOGO_DATA_URI}
            alt="Posinowa"
            className="mx-auto mb-1 h-14 w-auto object-contain"
          />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent border border-primary/20 text-primary font-extrabold text-[11px] uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Posinowa Teknoloji & Yazılım Akademisi
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 print:text-black font-serif pt-1">
            STAJ BAŞARI SERTİFİKASI
          </h1>
          <p className="text-[11px] uppercase tracking-widest text-slate-500 print:text-slate-600 font-semibold">
            Certificate of Internship Completion & Excellence
          </p>
        </div>

        {/* Sertifika Açıklama ve Öğrenci Adı */}
        <div className="text-center space-y-3 max-w-2xl mx-auto my-5">
          <p className="text-xs sm:text-sm text-slate-600 print:text-slate-700 leading-relaxed">
            Bu resmi belge, aşağıda adı geçen stajyerin Posinowa bünyesinde yürütülen yazılım geliştirme ve yapay zeka mühendisliği staj programını başarıyla tamamladığını onaylar:
          </p>

          <div className="py-2 border-b-2 border-slate-300 inline-block px-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-primary print:text-primary font-serif">
              {certificate.studentName}
            </h2>
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/5 border border-primary/20 text-primary font-bold text-xs">
              <Award className="w-3.5 h-3.5 text-primary" />
              Başarı Derecesi: <span className="font-extrabold">{completionGrade || "Belirlenmedi"}</span>
            </span>
          </div>
        </div>

        {/* Tamamlanan Projeler Listesi */}
        {certificate.completedProjects.length > 0 && (
          <div className="my-5 p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs">
            <p className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Staj Sürecinde Geliştirilen ve Tamamlanan Projeler:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {certificate.completedProjects.map((p) => (
                <div
                  key={p.id}
                  className="p-2 rounded-lg bg-white border border-slate-200/70 font-medium flex items-center justify-between"
                >
                  <span className="min-w-0 truncate text-slate-800 text-xs">
                    {p.title}
                    {/* #449: Takım projesi olarak işaretli; sayı bu
                        stajyerin KENDİ katkısı (takımın toplamı değil). */}
                    {p.takimAdi && (
                      <span className="text-slate-500">
                        {" "}· {p.takimAdi} · {p.completedStepsCount} adım
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-accent text-accent-foreground">
                    {p.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mentör / Yönetici Referans Notu (Kayma ve taşma önleyici simetrik yapı) */}
        {mentorNote && (
          <div className="my-5 p-4 rounded-xl bg-accent/60 border border-primary/15 relative">
            <div className="flex items-start gap-2.5">
              <Quote className="w-5 h-5 text-primary/50 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs italic text-slate-700 leading-relaxed font-serif">
                  &ldquo;{mentorNote}&rdquo;
                </p>
                {certificate.mentorName && (
                  <p className="text-[11px] font-bold text-primary text-right mt-2">
                    — {certificate.mentorName} (Teknik Mentör)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alt İmzalar & Mühür (Simetrik 3 Sütunlu Grid) */}
        <div className="grid grid-cols-3 gap-4 items-end pt-6 mt-4 border-t border-slate-200 text-center">
          
          {/* Mentör İmzası */}
          <div className="space-y-1">
            <div className="h-8 flex items-end justify-center">
              <span className="font-serif italic text-xs text-slate-700 font-bold">
                {certificate.mentorName || "Teknik Mentör"}
              </span>
            </div>
            <div className="w-28 border-t border-slate-400 mx-auto" />
            <p className="text-[11px] font-bold text-slate-800">Teknik Mentör</p>
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
              <span className="font-serif italic text-xs text-slate-700 font-bold">
                Posinowa Yönetim Kurulu
              </span>
            </div>
            <div className="w-28 border-t border-slate-400 mx-auto" />
            <p className="text-[11px] font-bold text-slate-800">Yönetici / Direktör</p>
            <p className="text-[10px] text-slate-500">Posinowa Akademi</p>
          </div>
        </div>

        {/* Doğrulama & Seri No Alt Çizgisi */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-400">
          <div className="flex flex-col gap-1">
            <span>Sertifika No: <strong className="font-mono text-slate-600">{certificate.certificateNumber}</strong></span>
            <span>
              Doğrulama:{" "}
              {/* #280: Önceden düz metindi; ekranda tıklanamıyordu. */}
              <a
                href={certificate.verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-2"
              >
                {certificate.verificationUrl}
              </a>
            </span>
          </div>

          {/* #323: QR — basılı/PDF sertifikada URL tıklanamaz. Belgeyi alan
              işverenin doğrulamaya ulaşabilmesi ancak karekodla mümkün. */}
          <div className="flex flex-col items-center gap-1">
            <SertifikaQr url={certificate.verificationUrl} boyut={72} />
            <span className="text-[8px] uppercase tracking-wider">Doğrula</span>
          </div>
        </div>

      </div>
    </div>
    </>
  );
}
