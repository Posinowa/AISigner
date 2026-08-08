"use client";

import { useState } from "react";
import { Award, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CertificateModal } from "@/components/certificate/CertificateModal";
import type { CertificateData } from "@/features/certificate/server/certificate";

export function StudentCertificateTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);

  const handleOpenCertificate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/certificate");
      const data = await res.json();
      if (res.ok && data.certificate) {
        setCertificate(data.certificate);
        setIsOpen(true);
      } else {
        toast.error(data.error || "Sertifika verisi alınamadı.");
      }
    } catch {
      toast.error("Sertifika yüklenirken bir bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpenCertificate}
        disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Award className="w-4 h-4 text-amber-950" />
        )}
        <span>Resmi Staj Sertifikamı Görüntüle & PDF İndir</span>
      </button>

      {certificate && (
        <CertificateModal
          certificate={certificate}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
