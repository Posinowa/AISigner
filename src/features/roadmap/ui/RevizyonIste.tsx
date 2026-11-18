"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { REVIZYON_GEREKCE_EN_AZ } from "@/lib/validations/api";

/**
 * Mentör onay kapısı — revizyon isteği (#379).
 *
 * ⚠️ GEREKÇE ZORUNLU ve öğrenciye gösteriliyor. Gerekçesiz revizyon,
 * öğrenciye aynı işi tekrar yaptırır (#366'daki red gerekçesi deseni).
 *
 * Yalnızca TAMAMLANMIŞ adımda görünür: revizyon, biten bir işe "eksik"
 * demektir; başlamamış adım için söylenecek şey yorumdur.
 */
export function RevizyonIste({
  stepId,
  stepStatus,
  onTamamlandi,
}: {
  stepId: string;
  stepStatus: string;
  onTamamlandi?: () => void;
}) {
  const [acik, setAcik] = useState(false);
  const [gerekce, setGerekce] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  if (stepStatus !== "COMPLETED") return null;

  // ⚠️ Buton kısa gerekçede pasif; nedeni yazılmazsa mentör neden
  // gönderemediğini anlamıyordu (canlı testte bulundu).
  const uzunluk = gerekce.trim().length;
  const yeterli = uzunluk >= REVIZYON_GEREKCE_EN_AZ;

  async function gonder() {
    setGonderiliyor(true);
    try {
      const res = await fetch(`/api/mentor/steps/${stepId}/revizyon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gerekce }),
      });
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof veri.error === "string" ? veri.error : "Revizyon istenemedi.");
        return;
      }
      toast.success("Revizyon istendi. Stajyer gerekçeyi görecek.");
      setAcik(false);
      setGerekce("");
      onTamamlandi?.();
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setGonderiliyor(false);
    }
  }

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Revizyon iste
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <label htmlFor={`rev-${stepId}`} className="text-xs font-semibold text-amber-900">
        Revizyon gerekçesi (zorunlu) — stajyer bunu görecek
      </label>
      <textarea
        id={`rev-${stepId}`}
        value={gerekce}
        onChange={(e) => setGerekce(e.target.value)}
        rows={3}
        maxLength={1000}
        aria-describedby={`rev-${stepId}-sinir`}
        className="mt-1.5 w-full rounded-md border border-amber-300 bg-white p-2 text-sm focus:border-amber-500 focus:outline-none"
        placeholder="Örn: Testler yazılmamış ve hata durumu ele alınmamış. İkisini tamamlayıp tekrar gönderebilirsin."
      />
      <p
        id={`rev-${stepId}-sinir`}
        aria-live="polite"
        className={`mt-1 text-[11px] ${yeterli ? "text-amber-700" : "font-medium text-amber-900"}`}
      >
        {yeterli
          ? "Adım \"Revizyon istendi\" durumuna döner; stajyer yeniden başlatıp düzeltebilir."
          : `En az ${REVIZYON_GEREKCE_EN_AZ} karakter yazın (${uzunluk}/${REVIZYON_GEREKCE_EN_AZ}).`}
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setAcik(false)}
          className="rounded-md px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={gonder}
          disabled={gonderiliyor || !yeterli}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-slate-300"
        >
          {gonderiliyor && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Revizyon iste
        </button>
      </div>
    </div>
  );
}
