"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { dogrulandiMi, type DogrulamaDurumu } from "./DogrulanmisRozet";

/**
 * #261: Doğrulama e-postasını yeniden isteme.
 *
 * `DogrulanmisRozet`'ten AYRI tutuldu: rozet admin panelinde BAŞKA
 * kullanıcılar için de gösteriliyor, orada "yeniden gönder" anlamsız olurdu.
 * Bu bileşen yalnızca kullanıcının kendi panelinde kullanılıyor.
 *
 * Hesap doğrulanmışsa hiçbir şey render edilmiyor.
 */
export function DogrulamaYenidenGonder({
  emailVerified,
}: {
  emailVerified: DogrulamaDurumu;
}) {
  const router = useRouter();
  const [bekliyor, setBekliyor] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  if (dogrulandiMi(emailVerified)) return null;

  async function gonder() {
    setBekliyor(true);
    setMesaj(null);
    setHata(null);

    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setHata(data?.error ?? "Doğrulama e-postası gönderilemedi.");
        return;
      }

      setMesaj(data?.message ?? "Doğrulama bağlantısı gönderildi.");

      // Hesap bu arada doğrulanmışsa rozet güncellensin.
      if (data?.alreadyVerified) router.refresh();
    } catch {
      setHata("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={gonder}
        disabled={bekliyor}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:border-amber-300 disabled:opacity-60"
      >
        {bekliyor ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Doğrulama e-postasını yeniden gönder
      </button>

      {mesaj && (
        <span role="status" className="text-xs font-medium text-emerald-700">
          {mesaj}
        </span>
      )}
      {hata && (
        <span role="alert" className="text-xs font-medium text-red-600">
          {hata}
        </span>
      )}
    </span>
  );
}
