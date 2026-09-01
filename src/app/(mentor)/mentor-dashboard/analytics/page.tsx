import Link from "next/link";
import { AnalitikPanel } from "@/features/analytics/ui/AnalitikPanel";

/**
 * Mentörün kendi analitiği (#331).
 *
 * Kapsam sunucuda oturumdan daraltılıyor; bu sayfa yalnızca uca bağlanıyor.
 */
export default function MentorAnalitikSayfasi() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href="/mentor-dashboard" className="text-xs font-medium text-blue-600 hover:underline">
        &larr; Panele Dön
      </Link>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
        Analitik
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Yalnızca sizin öğrencileriniz ve sizin yanıt süreniz.
      </p>

      <div className="mt-6">
        <AnalitikPanel kaynak="/api/mentor/analytics" />
      </div>
    </div>
  );
}
