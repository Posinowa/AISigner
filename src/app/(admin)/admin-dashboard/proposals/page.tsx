import Link from "next/link";
import { OneriKuyrugu } from "@/features/proposals/ui/OneriKuyrugu";

export const metadata = { title: "Proje Önerileri | AISigner" };

/** Stajyerlerin kendi proje önerilerinin onay kuyruğu (#366). */
export default function ProposalsPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link
        href="/admin-dashboard"
        className="text-xs font-medium text-indigo-600 hover:underline"
      >
        &larr; Yönetici Paneline Dön
      </Link>

      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
        Proje Önerileri
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Stajyerlerin kendi önerdiği projeler. Onayladığınızda öneri bir atamaya
        dönüşür; GitHub kaynağına (yeni depo / bağlama / devir) siz karar verirsiniz.
      </p>

      <div className="mt-6">
        <OneriKuyrugu />
      </div>
    </div>
  );
}
