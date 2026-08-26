"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/features/auth/ui/AuthCard";
import { AuthField } from "@/features/auth/ui/AuthField";
import { FormAlert } from "@/features/auth/ui/FormAlert";
import { AuthSubmitButton } from "@/features/auth/ui/AuthSubmitButton";

/**
 * #262: Şifre sıfırlama talebi.
 *
 * Önceki akış güvenlik sorularına dayanan üç adımlı bir sihirbazdı ve ara
 * tokenı süreç belleğinde tutuyordu; çok instance'lı üretimde kırılıyordu.
 * Artık tek adım: e-posta gir, bağlantı gelsin.
 *
 * Yanıt hesabın var olup olmadığını ELE VERMEZ — başarı ekranı her durumda
 * aynı metni gösterir.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [gonderildi, setGonderildi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setHata(data?.error ?? "İstek gönderilemedi. Lütfen tekrar deneyin.");
        return;
      }

      setGonderildi(true);
    } catch {
      setHata("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBekliyor(false);
    }
  }

  const girisBaglantisi = (
    <p className="mt-6 text-center text-xs text-slate-500">
      <Link href="/signin" className="underline hover:text-slate-700">
        Giriş ekranına dön
      </Link>
    </p>
  );

  if (gonderildi) {
    return (
      <AuthCard
        title="Bağlantı gönderildi"
        subtitle="Gelen kutunuzu kontrol edin."
        footer={girisBaglantisi}
      >
        <FormAlert variant="success" title="Talebiniz alındı">
          Bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi.
          Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir.
        </FormAlert>

        <p className="text-center text-xs text-slate-500">
          E-posta gelmediyse spam klasörünü kontrol edin.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Şifremi Unuttum"
      subtitle="Hesabınıza kayıtlı e-posta adresini girin; sıfırlama bağlantısı gönderelim."
      footer={girisBaglantisi}
    >
      <form onSubmit={gonder} className="space-y-5">
        <AuthField
          id="forgot-email"
          name="email"
          label="E-posta"
          type="email"
          autoComplete="email"
          required
          placeholder="ornek@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {hata && <FormAlert variant="error">{hata}</FormAlert>}

        <AuthSubmitButton
          pending={bekliyor}
          label="Sıfırlama Bağlantısı Gönder"
          pendingLabel="Gönderiliyor..."
        />
      </form>
    </AuthCard>
  );
}
