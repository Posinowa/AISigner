"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/features/auth/ui/AuthCard";
import { AuthField } from "@/features/auth/ui/AuthField";
import { FormAlert } from "@/features/auth/ui/FormAlert";
import { AuthSubmitButton } from "@/features/auth/ui/AuthSubmitButton";
import { PasswordRules } from "@/features/auth/ui/PasswordRules";

/**
 * #262: E-postadaki sıfırlama bağlantısının indiği ekran.
 *
 * Token URL'den geliyor ve doğrulaması SUNUCUDA yapılıyor; burada yalnızca
 * taşınıyor. Token tek kullanımlık: şifre değiştiği anda imza geçersizleşir.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [sifre, setSifre] = useState("");
  const [tamam, setTamam] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const girisBaglantisi = (
    <p className="mt-6 text-center text-xs text-slate-500">
      <Link href="/signin" className="underline hover:text-slate-700">
        Giriş ekranına dön
      </Link>
    </p>
  );

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: sifre }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setHata(data?.error ?? "Şifre güncellenemedi. Lütfen tekrar deneyin.");
        return;
      }

      setTamam(true);
    } catch {
      setHata("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBekliyor(false);
    }
  }

  // Token yoksa form gösterilmiyor: boş token ile istek atmanın anlamı yok.
  if (!token) {
    return (
      <AuthCard
        title="Bağlantı geçersiz"
        subtitle="Sıfırlama bağlantısı eksik görünüyor."
        footer={girisBaglantisi}
      >
        <FormAlert variant="error" title="Bağlantı okunamadı">
          E-postadaki adresin tamamını kopyaladığınızdan emin olun.
        </FormAlert>

        <p className="text-center text-xs text-slate-500">
          <Link
            href="/forgot-password"
            className="font-semibold text-primary hover:underline"
          >
            Yeni bir sıfırlama bağlantısı isteyin
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (tamam) {
    return (
      <AuthCard
        title="Şifreniz güncellendi"
        subtitle="Yeni şifrenizle giriş yapabilirsiniz."
        footer={girisBaglantisi}
      >
        <FormAlert variant="success" title="İşlem tamamlandı">
          Şifreniz değiştirildi. Bu sıfırlama bağlantısı artık geçersiz.
        </FormAlert>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Yeni Şifre Belirle"
      subtitle="Hesabınız için yeni bir şifre seçin."
      footer={girisBaglantisi}
    >
      <form onSubmit={gonder} className="space-y-5">
        <AuthField
          id="reset-password"
          name="password"
          label="Yeni Şifre"
          revealable
          autoComplete="new-password"
          required
          placeholder="En az 8 karakter"
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          belowField={<PasswordRules password={sifre} />}
        />

        {hata && <FormAlert variant="error">{hata}</FormAlert>}

        <AuthSubmitButton
          pending={bekliyor}
          label="Şifreyi Güncelle"
          pendingLabel="Güncelleniyor..."
        />
      </form>
    </AuthCard>
  );
}

// Suspense boundary — useSearchParams için zorunlu (Next.js 15)
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
