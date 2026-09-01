import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * 404 sayfası. Bilinmeyen bir rotaya gidildiğinde Next.js'in ham 404'ü yerine
 * tasarım sistemine uygun dostça bir ekran gösterilir.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl ring-1 ring-slate-200/60 overflow-hidden text-center">
        <div className="h-1.5 bg-gradient-to-r from-primary via-[#3e92cc] to-emerald-500" />
        <div className="p-8">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Compass className="w-7 h-7 text-blue-600" />
          </div>
          <p className="text-4xl font-black text-slate-900">404</p>
          <h1 className="mt-1 text-lg font-bold text-slate-800">Sayfa bulunamadı</h1>
          <p className="mt-2 text-sm text-slate-500">
            Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-3 font-semibold text-white transition-all"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}
