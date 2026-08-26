"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { DESTEKLENEN_UZANTILAR } from "@/lib/images";

/**
 * #265: Kullanıcının kendi profil fotoğrafını yönettiği bileşen.
 *
 * Doğrulama SUNUCUDA yapılıyor — buradaki `accept` yalnızca dosya seçiciyi
 * daraltmak için, koruma değil.
 */
export function AvatarUpload({
  userId,
  basHarfler,
  fotografVar: baslangictaVar,
  ad,
}: {
  userId: string;
  basHarfler: string;
  fotografVar: boolean;
  ad?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fotografVar, setFotografVar] = useState(baslangictaVar);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  // Fotoğraf değişince tarayıcı önbelleğini atlamak için.
  const [surum, setSurum] = useState(0);

  async function yukle(dosya: File) {
    setBekliyor(true);
    setHata(null);

    try {
      const form = new FormData();
      form.set("file", dosya);

      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setHata(data?.error ?? "Fotoğraf yüklenemedi.");
        return;
      }

      setFotografVar(true);
      setSurum((s) => s + 1);
      router.refresh();
    } catch {
      setHata("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBekliyor(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function kaldir() {
    setBekliyor(true);
    setHata(null);

    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) {
        setHata("Fotoğraf kaldırılamadı.");
        return;
      }
      setFotografVar(false);
      setSurum((s) => s + 1);
      router.refresh();
    } catch {
      setHata("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div key={surum}>
        <Avatar
          userId={userId}
          basHarfler={basHarfler}
          fotografVar={fotografVar}
          ad={ad}
          boyutSinifi="w-20 h-20"
        />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">Profil Fotoğrafı</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {DESTEKLENEN_UZANTILAR.join(", ")} · en fazla 5 MB
        </p>

        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={bekliyor}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {bekliyor ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {fotografVar ? "Değiştir" : "Fotoğraf Yükle"}
          </button>

          {fotografVar && (
            <button
              type="button"
              onClick={kaldir}
              disabled={bekliyor}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Kaldır
            </button>
          )}
        </div>

        {hata && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">
            {hata}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          aria-label="Profil fotoğrafı seç"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void yukle(f);
          }}
        />
      </div>
    </div>
  );
}
