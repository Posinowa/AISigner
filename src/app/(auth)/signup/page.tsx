"use client"

import { Suspense, useState } from "react"
import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { signupAction } from "./actions"
import Link from "next/link"
import { AuthCard } from "@/features/auth/ui/AuthCard"
import { AuthField } from "@/features/auth/ui/AuthField"
import { FormAlert } from "@/features/auth/ui/FormAlert"
import { AuthSubmitButton } from "@/features/auth/ui/AuthSubmitButton"
import { PasswordRules } from "@/features/auth/ui/PasswordRules"
import { AI_RIZA_ALANI, RIZA_OZETI } from "@/features/kvkk/riza-alani"
import {
  BASVURU_ALAN_ADI,
  basvuruTipiCoz,
} from "@/features/auth/models/basvuru-tipi"

const initialState = { error: {} as Record<string, string[]> }

// useSearchParams Suspense boundary gerektiriyor — iç bileşene taşındı
function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState)
  const [password, setPassword] = useState("")
  // #250: Açılış sayfasındaki "Mentör olmak istiyorum" buraya ?rol=mentor ile gelir.
  // Görünen metin buna göre değişiyor; asıl rol kararı SUNUCUDA veriliyor.
  const searchParams = useSearchParams()
  const basvuruTipi = basvuruTipiCoz(searchParams.get("rol"))
  const mentorBasvurusu = basvuruTipi === "mentor"

  return (
    <AuthCard
      title={mentorBasvurusu ? "Mentör Başvurusu" : "Hesap Oluştur"}
      width="lg"
      subtitle={
        <>
          Zaten hesabınız var mı?{" "}
          <Link href="/signin" className="font-semibold text-primary hover:text-primary/80">
            Giriş yapın
          </Link>
        </>
      }
      footer={
        <p className="mt-6 text-center text-xs text-slate-500">
          Kayıt olarak{" "}
          <Link href="/terms" className="underline hover:text-slate-700">
            Kullanım Koşulları
          </Link>
          {"'nı kabul etmiş olursunuz."}
        </p>
      }
    >
      <form action={formAction} className="space-y-5">
        {/* Sunucu bu alana güvenmiyor; beyaz listeyle çözüyor (#250). */}
        <input type="hidden" name={BASVURU_ALAN_ADI} value={basvuruTipi} />

        {mentorBasvurusu && (
          <FormAlert variant="success" title="Mentör olarak başvuruyorsunuz">
            Başvurunuz ekibimize iletilecek. Onaylandığında mentör paneline
            erişebilirsiniz.
          </FormAlert>
        )}

        {/* #153: Dar telefonlarda iki alan yan yana sıkışıyordu — sm'den itibaren iki sütun. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AuthField
            id="signup-name"
            name="name"
            label="Ad"
            autoComplete="given-name"
            placeholder="Adınız"
            required
            errors={state.error?.name}
          />
          <AuthField
            id="signup-lastName"
            name="lastName"
            label="Soyad"
            autoComplete="family-name"
            placeholder="Soyadınız"
            required
            errors={state.error?.lastName}
          />
        </div>

        <AuthField
          id="signup-email"
          name="email"
          label="E-posta"
          type="email"
          autoComplete="email"
          required
          placeholder="ornek@email.com"
          errors={state.error?.email}
        />

        <AuthField
          id="signup-phone"
          name="phone"
          label="Telefon"
          hint="(opsiyonel)"
          type="tel"
          autoComplete="tel"
          placeholder="05xx xxx xx xx"
          errors={state.error?.phone}
        />

        <AuthField
          id="signup-password"
          name="password"
          label="Şifre"
          revealable
          autoComplete="new-password"
          required
          placeholder="En az 8 karakter"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errors={state.error?.password}
          belowField={<PasswordRules password={password} />}
        />

        {/* #321: KVKK AÇIK RIZA — AYRI ve ÖNCEDEN İŞARETLENMEMİŞ.
            Kullanım Koşulları kabulüyle BİRLEŞTİRİLMEZ: açık rızanın
            "ayrılabilir" olması gerekiyor. İşaretlenmezse kayıt yine tamamlanır,
            yalnızca AI özellikleri kapalı kalır — zorunlu tutmak rızayı
            "özgür irade" olmaktan çıkarırdı. */}
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs leading-relaxed text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            name={AI_RIZA_ALANI}
            value="evet"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#23356c]"
          />
          <span>
            {RIZA_OZETI}{" "}
            <Link href="/privacy" className="underline hover:text-slate-800">
              Gizlilik Politikası
            </Link>
            {". Bu onay isteğe bağlıdır; vermezseniz de kayıt olabilirsiniz, "}
            {"yalnızca yapay zekâ özellikleri kapalı kalır. Dilediğiniz zaman "}
            {"profilinizden geri alabilirsiniz."}
          </span>
        </label>

        {state.error?.general && (
          <FormAlert variant="error">{state.error.general[0]}</FormAlert>
        )}

        <AuthSubmitButton
          pending={isPending}
          label={mentorBasvurusu ? "Başvuruyu Gönder" : "Hesap Oluştur"}
          pendingLabel={mentorBasvurusu ? "Başvuru gönderiliyor..." : "Kayıt yapılıyor..."}
        />
      </form>
    </AuthCard>
  )
}

// Suspense boundary — useSearchParams için zorunlu (Next.js 15)
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
