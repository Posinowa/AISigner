import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import type { ReactNode } from "react";

/**
 * #171: Kullanım Koşulları / Gizlilik gibi statik yasal sayfaların ortak kabuğu.
 * Oturumsuz da erişilebilir (middleware public yollarında).
 */
export function LegalPage({
  title,
  updatedAt,
  /** Diğer yasal sayfaya çapraz bağlantı (koşullar ↔ gizlilik). */
  crossLink,
  children,
}: {
  title: string;
  updatedAt: string;
  crossLink: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8 flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
            <GraduationCap className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">AISigner</span>
        </div>

        <article className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm p-8 sm:p-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1.5">Son güncelleme: {updatedAt}</p>

          <div className="mt-8 space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:text-sm [&_li]:text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
            {children}
          </div>
        </article>

        <div className="mt-6 flex items-center justify-between gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" />
            Kayıt sayfasına dön
          </Link>
          <Link
            href={crossLink.href}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
          >
            {crossLink.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
