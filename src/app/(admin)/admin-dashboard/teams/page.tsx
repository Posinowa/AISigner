import Link from "next/link";
import { TakimYonetimi } from "@/features/teams/ui/TakimYonetimi";

/** Takım yönetimi (#332 Faz 2). Rol koruması `(admin)` layout'unda. */
export default function TakimlarSayfasi() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link href="/admin-dashboard" className="text-xs font-medium text-indigo-600 hover:underline">
        &larr; Yönetici Paneline Dön
      </Link>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
        Takımlar
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        2–4 kişilik takımlar ortak bir pano ve ortak bir repo üzerinde çalışır. Sertifika
        bireysel kalır; katkı, adımı üstlenen ve tamamlayan kayıtlarından ölçülür.
      </p>

      <div className="mt-6">
        <TakimYonetimi />
      </div>
    </div>
  );
}
