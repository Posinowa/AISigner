"use client";

import { useState } from "react";
import { Github, Loader2, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { tarihBicimle } from "@/lib/tarih";

/**
 * Mentör ekranındaki çalışma alanı bölümü (#349).
 *
 * Mentör repoyu AÇMAZ, talep eder. Bu ayrım arayüzde de görünür olmalı:
 * düğme "Kur" değil "Talep et" der ve altında onaya gideceği yazar — aksi
 * halde mentör düğmeye basıp reponun açıldığını sanır.
 */

export type CalismaAlaniTalebi = {
  id: string;
  status: string;
  adminNote: string | null;
  createdAt: string | Date;
  decidedAt: string | Date | null;
};

type Props = {
  assignedProjectId: string;
  githubStatus: string;
  githubRepoUrl: string | null;
  talep: CalismaAlaniTalebi | null;
  /** Yol haritası yayınlanmamışsa talep açılamaz — sebebi gösterilir. */
  yolHaritasiHazir: boolean;
  onDegisti: () => void;
};

const KURULU = new Set(["PROVISIONED", "PROVISIONING"]);

export function CalismaAlaniBolumu({
  assignedProjectId,
  githubStatus,
  githubRepoUrl,
  talep,
  yolHaritasiHazir,
  onDegisti,
}: Props) {
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function talepEt() {
    setGonderiliyor(true);
    try {
      const res = await fetch("/api/mentor/workspace-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedProjectId }),
      });
      const veri = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof veri.error === "string" ? veri.error : "Talep gönderilemedi.");
        return;
      }

      toast.success("Talep gönderildi. Yönetici onayladığında çalışma alanı kurulacak.");
      onDegisti();
    } catch {
      toast.error("Talep gönderilemedi. Bağlantınızı kontrol edin.");
    } finally {
      setGonderiliyor(false);
    }
  }

  // Kurulmuş ya da kuruluyor: talep etmenin anlamı yok.
  if (KURULU.has(githubStatus)) {
    return (
      <Kutu>
        {githubStatus === "PROVISIONING" ? (
          <span className="flex items-center gap-2 text-sm text-blue-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            Çalışma alanı kuruluyor…
          </span>
        ) : (
          <span className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Çalışma alanı hazır
          </span>
        )}
        {githubRepoUrl && (
          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            <Github className="w-4 h-4" />
            Repoyu aç
          </a>
        )}
      </Kutu>
    );
  }

  if (talep?.status === "PENDING") {
    return (
      <Kutu>
        <span className="flex items-center gap-2 text-sm text-amber-700">
          <Clock className="w-4 h-4" />
          Talebiniz yönetici onayında
        </span>
        <span className="text-xs text-slate-500">
          {tarihBicimle(talep.createdAt)}
        </span>
      </Kutu>
    );
  }

  // Kurulum başarısız: mentör bunu görmeli ve yeniden talep edebilmeli.
  const kurulumHatasi = githubStatus === "ERROR";

  return (
    <div className="pt-4 border-t border-slate-100 -mx-5 -mb-5 p-4 rounded-b-lg bg-slate-50/60">
      {talep?.status === "REJECTED" && (
        <div className="mb-3 flex gap-2 rounded-lg bg-red-50 border border-red-100 p-3">
          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-red-800">Önceki talep reddedildi</p>
            {/* Gerekçe sunucuda ZORUNLU; mentör nedenini görmezse aynı talebi
                tekrar açar. */}
            {talep.adminNote && <p className="text-red-700 mt-0.5">{talep.adminNote}</p>}
          </div>
        </div>
      )}

      {kurulumHatasi && (
        <div className="mb-3 flex gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Önceki kurulum tamamlanamadı</p>
            <p className="text-amber-700 mt-0.5">Yeniden talep edebilirsiniz.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          <span className="flex items-center gap-1.5 font-medium text-slate-700">
            <Github className="w-4 h-4" />
            GitHub çalışma alanı
          </span>
          <span className="text-xs text-slate-500">
            {yolHaritasiHazir
              ? "Talebiniz yönetici onayına gider; repo onaydan sonra açılır."
              : "Önce en az bir adımı olan bir yol haritası hazırlayın."}
          </span>
        </div>

        <button
          onClick={talepEt}
          disabled={gonderiliyor || !yolHaritasiHazir}
          className="shrink-0 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {gonderiliyor ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Gönderiliyor…
            </>
          ) : (
            "Çalışma alanı talep et"
          )}
        </button>
      </div>
    </div>
  );
}

function Kutu({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-4 border-t border-slate-100 -mx-5 -mb-5 p-4 rounded-b-lg bg-slate-50/60 flex items-center justify-between gap-3">
      {children}
    </div>
  );
}
