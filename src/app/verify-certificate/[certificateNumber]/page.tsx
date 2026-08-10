import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  XCircle,
  Sparkles,
  Calendar,
  User,
  ArrowLeft,
  Briefcase,
} from "lucide-react";
import { verifyCertificate } from "@/features/certificate/server/certificate";

type Props = {
  params: Promise<{ certificateNumber: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certificateNumber } = await params;
  const decodedNumber = decodeURIComponent(certificateNumber);
  const result = await verifyCertificate(decodedNumber);

  if (result.isValid && result.certificate) {
    return {
      title: `Sertifika Doğrulandı: ${result.certificate.studentName} (${result.certificate.certificateNumber}) — Posinowa`,
      description: `Posinowa Akademi staj başarı sertifikası doğrulaması: ${result.certificate.studentName}. Seri No: ${result.certificate.certificateNumber}.`,
    };
  }

  return {
    title: "Sertifika Doğrulama — Posinowa Teknoloji Akademisi",
    description: "Posinowa staj başarı belgesi ve sertifika doğrulama sistemi.",
  };
}

export default async function VerifyCertificatePage({ params }: Props) {
  const { certificateNumber } = await params;
  const decodedNumber = decodeURIComponent(certificateNumber);
  const result = await verifyCertificate(decodedNumber);

  const formattedDate =
    result.isValid && result.certificate?.issuedAt
      ? new Date(result.certificate.issuedAt).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-2xl space-y-6">
        
        {/* Üst Logo ve Geri Dön Linki */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" /> Posinowa Doğrulama Sistemi
          </span>
        </div>

        {/* Sertifika Kartı */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          {result.isValid && result.certificate ? (
            <div>
              {/* Geçerli Belge Üst Banner */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 sm:p-8 text-white text-center space-y-2">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-2 border border-white/30 shadow-md">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold uppercase tracking-wider backdrop-blur-sm">
                  Resmi Olarak Doğrulandı
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Staj Başarı Sertifikası Geçerlidir
                </h1>
                <p className="text-xs sm:text-sm text-emerald-100 font-medium max-w-md mx-auto">
                  Bu belge Posinowa Teknoloji & Yazılım Akademisi veritabanında kayıtlı ve doğrulanmış resmi bir sertifikadır.
                </p>
              </div>

              {/* Sertifika Detayları */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Sertifika Sahibi
                    </p>
                    <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      {result.certificate.studentName}
                    </p>
                  </div>

                  <div className="space-y-1 sm:text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Seri Numarası
                    </p>
                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 inline-block px-2.5 py-1 rounded-lg">
                      {result.certificate.certificateNumber}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-400 block">Başarı Derecesi</span>
                    <span className="inline-flex items-center gap-1 font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-md">
                      <Award className="w-3.5 h-3.5 text-purple-600" />
                      {result.certificate.completionGrade || "Belirlenmedi"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-slate-400 block">Düzenlenme Tarihi</span>
                    <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {formattedDate || "Resmi Belge"}
                    </span>
                  </div>

                  <div className="space-y-1 sm:text-right">
                    <span className="font-semibold text-slate-400 block">Teknik Mentör</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {result.certificate.mentorName || "Posinowa Mentorluk Ekibi"}
                    </span>
                  </div>
                </div>

                {/* Tamamlanan Projeler Listesi */}
                {result.certificate.completedProjects.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Staj Sürecinde Tamamlanan Projeler ({result.certificate.completedProjects.length})
                    </p>
                    <div className="space-y-2">
                      {result.certificate.completedProjects.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium"
                        >
                          <span className="text-slate-900 dark:text-slate-100 font-semibold truncate">
                            {p.title}
                          </span>
                          <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            {p.difficulty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kurumsal Onay Mührü */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dijital Olarak İmzalandı
                  </span>
                  <span>Posinowa Teknoloji & Akademi</span>
                </div>
              </div>
            </div>
          ) : (
            /* Geçersiz / Bulunamayan Belge */
            <div className="p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                <XCircle className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Sertifika Doğrulanamadı
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                {result.message || "Belirtilen seri numarasına ait resmi veya onaylanmış bir sertifika kaydı bulunamadı."}
              </p>
              <div className="pt-2">
                <p className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 inline-block px-3 py-1.5 rounded-lg">
                  Aranan No: {decodedNumber}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Alt Bilgi */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Posinowa Staj ve Proje Yönetim Platformu © {new Date().getFullYear()} — Tüm hakları saklıdır.
        </p>

      </div>
    </main>
  );
}
