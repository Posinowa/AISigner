import Link from "next/link";
import { AnalitikPanel } from "@/features/analytics/ui/AnalitikPanel";

/** Platform geneli analitik (#331). Rol koruması `(admin)` layout'unda. */
export default function AdminAnalitikSayfasi() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href="/admin-dashboard" className="text-xs font-medium text-indigo-600 hover:underline">
        &larr; Yönetici Paneline Dön
      </Link>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
        Analitik
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Öğrenciler nerede takılıyor, mentörler ne kadar sürede dönüyor, kim gözden
        geçirilmeli.
      </p>

      <div className="mt-6">
        <AnalitikPanel kaynak="/api/admin/analytics" />
      </div>
    </div>
  );
}
