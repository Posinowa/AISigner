import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { createRateLimiter } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
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
import { tarihUzunBicimle } from "@/lib/tarih";

type Props = {
  params: Promise<{ certificateNumber: string }>;
};

// #208 review: Public uç → seri no enumeration'a karşı IP başına basit rate-limit.
const verifyLimiter = createRateLimiter("verify-certificate", {
  maxRequests: 20,
  windowSeconds: 60,
});

/**
 * #208 review: Rate-limit kontrolü DOĞRULAMA SORGUSUNUN İÇİNDE.
 *
 * Next.js `generateMetadata`'yı sayfa gövdesinden ÖNCE çalıştırır. Limit yalnız
 * sayfa gövdesinde olsaydı, limiti aşan istek yine de metadata üzerinden DB'ye
 * gidip `<title>`'a **öğrenci adı + seri no** yazardı (enumeration + PII sızıntısı).
 * Kontrolü buraya alarak her iki yolu da kapsıyoruz.
 *
 * `cache` sayesinde istek başına yalnız BİR kez çalışır → limiter tek sayılır ve
 * DB'ye tek sorgu gider (metadata + gövde paylaşır).
 */
const getVerification = cache(
  async (
    certificateNumber: string,
  ): Promise<
    | { rateLimited: true }
    | { rateLimited: false; result: Awaited<ReturnType<typeof verifyCertificate>> }
  > => {
    const ip = getClientIp(await headers());
    if (!(await verifyLimiter.check(ip)).allowed) {
      return { rateLimited: true };
    }
    return { rateLimited: false, result: await verifyCertificate(certificateNumber) };
  },
);

// #208 review: Bu sayfa kişisel veri (ad + seri no) gösterir → arama motorlarına
// ASLA indekslenmemeli. Tüm metadata yanıtlarında geçerli.
const NOINDEX = { index: false, follow: false } as const;

const GENERIC_METADATA: Metadata = {
  title: "Sertifika Doğrulama — Posinowa Teknoloji Akademisi",
  description: "Posinowa staj başarı belgesi ve sertifika doğrulama sistemi.",
  robots: NOINDEX,
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certificateNumber } = await params;
  const decodedNumber = decodeURIComponent(certificateNumber);
  const verification = await getVerification(decodedNumber);

  // Limit aşıldıysa metadata'da ad/seri no OLMAZ — aksi halde 429 ekranı gösterilse
  // bile <title> üzerinden belge varlığı + öğrenci adı sızardı.
  if (verification.rateLimited) {
    return GENERIC_METADATA;
  }

  const result = verification.result;
  if (result.isValid && result.certificate) {
    return {
      title: `Sertifika Doğrulandı: ${result.certificate.studentName} (${result.certificate.certificateNumber}) — Posinowa`,
      description: `Posinowa Akademi staj başarı sertifikası doğrulaması: ${result.certificate.studentName}. Seri No: ${result.certificate.certificateNumber}.`,
      robots: NOINDEX,
    };
  }

  return GENERIC_METADATA;
}

export default async function VerifyCertificatePage({ params }: Props) {
  const { certificateNumber } = await params;
  const decodedNumber = decodeURIComponent(certificateNumber);

  // #208 review: Enumeration koruması — IP başına dakikada 20 sorgu. Kontrol
  // `getVerification` içinde (metadata yolu da kapsansın diye); burada yalnız sonucu
  // ekrana çeviriyoruz. `cache` sayesinde limiter istek başına bir kez sayılır.
  const verification = await getVerification(decodedNumber);
  if (verification.rateLimited) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-lg p-8 space-y-3">
          <h1 className="text-xl font-bold text-slate-900">
            Çok fazla doğrulama denemesi
          </h1>
          <p className="text-sm text-slate-600">
            Güvenlik nedeniyle sorgu sayısı sınırlandırılmıştır. Lütfen bir dakika sonra tekrar deneyin.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </main>
    );
  }

  const result = verification.result;

  // #460: Sunucuda render ediliyor ve üretimde konteyner UTC — saat dilimi
  // verilmediğinde gece yarısına yakın düzenlenen belgeler BİR GÜN GERİ
  // görünüyordu. Bu tarih kalıcı ve işverene gösteriliyor.
  const formattedDate =
    result.isValid && result.certificate?.issuedAt
      ? tarihUzunBicimle(result.certificate.issuedAt)
      : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-slate-100 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-2xl space-y-6">
        
        {/* Üst Logo ve Geri Dön Linki */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600">
            <Sparkles className="w-3.5 h-3.5" /> Posinowa Doğrulama Sistemi
          </span>
        </div>

        {/* Sertifika Kartı */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Sertifika Sahibi
                    </p>
                    <p className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600" />
                      {result.certificate.studentName}
                    </p>
                  </div>

                  <div className="space-y-1 sm:text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Seri Numarası
                    </p>
                    <p className="font-mono text-sm font-bold text-slate-800 bg-slate-100 inline-block px-2.5 py-1 rounded-lg">
                      {result.certificate.certificateNumber}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-slate-100 text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-400 block">Başarı Derecesi</span>
                    <span className="inline-flex items-center gap-1 font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-md">
                      <Award className="w-3.5 h-3.5 text-primary" />
                      {result.certificate.completionGrade || "Belirlenmedi"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-slate-400 block">Düzenlenme Tarihi</span>
                    <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {formattedDate || "Resmi Belge"}
                    </span>
                  </div>

                  <div className="space-y-1 sm:text-right">
                    <span className="font-semibold text-slate-400 block">Teknik Mentör</span>
                    <span className="font-bold text-slate-800">
                      {result.certificate.mentorName || "Posinowa Mentorluk Ekibi"}
                    </span>
                  </div>
                </div>

                {/* Tamamlanan Projeler Listesi */}
                {result.certificate.completedProjects.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                      Staj Sürecinde Tamamlanan Projeler ({result.certificate.completedProjects.length})
                    </p>
                    <div className="space-y-2">
                      {result.certificate.completedProjects.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs font-medium"
                        >
                          <span className="min-w-0 text-slate-900 font-semibold truncate">
                            {p.title}
                            {/* #449: TAKIM projesi bireysel işmiş gibi
                                durmamalı. Katkı bireysel ölçüldüğü için
                                sayı da bu stajyerin kendi adımlarıdır. */}
                            {p.takimAdi && (
                              <span className="ml-1.5 font-normal text-slate-500">
                                · {p.takimAdi} · {p.completedStepsCount} adım katkı
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            {p.difficulty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kurumsal Onay Mührü */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dijital Olarak İmzalandı
                  </span>
                  <span>Posinowa Teknoloji & Akademi</span>
                </div>
              </div>
            </div>
          ) : (
            /* Geçersiz / Bulunamayan Belge */
            <div className="p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600">
                <XCircle className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                Sertifika Doğrulanamadı
              </h1>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {result.message || "Belirtilen seri numarasına ait resmi veya onaylanmış bir sertifika kaydı bulunamadı."}
              </p>
              <div className="pt-2">
                <p className="text-xs font-mono text-slate-400 bg-slate-100 inline-block px-3 py-1.5 rounded-lg">
                  Aranan No: {decodedNumber}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Alt Bilgi */}
        <p className="text-center text-xs text-slate-400">
          Posinowa Staj ve Proje Yönetim Platformu © {new Date().getFullYear()} — Tüm hakları saklıdır.
        </p>

      </div>
    </main>
  );
}
