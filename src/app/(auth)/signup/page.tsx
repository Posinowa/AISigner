"use client"

import { useState } from "react"
import { useActionState } from "react"
import { signupAction } from "./actions"
import { UserPlus, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { AuthCard } from "@/features/auth/ui/AuthCard"
import { AuthField } from "@/features/auth/ui/AuthField"
import { FormAlert } from "@/features/auth/ui/FormAlert"
import { AuthSubmitButton } from "@/features/auth/ui/AuthSubmitButton"

const initialState = { error: {} as Record<string, string[]> }

const passwordRules = [
  { test: (p: string) => p.length >= 8, label: "En az 8 karakter" },
  { test: (p: string) => /[A-Z]/.test(p), label: "En az bir büyük harf" },
  { test: (p: string) => /[a-z]/.test(p), label: "En az bir küçük harf" },
  { test: (p: string) => /[0-9]/.test(p), label: "En az bir rakam" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "En az bir özel karakter" },
]

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState)
  const [password, setPassword] = useState("")

  const metCount = passwordRules.filter((r) => r.test(password)).length

  return (
    <AuthCard
      icon={UserPlus}
      title="Hesap Oluştur"
      width="lg"
      subtitle={
        <>
          Zaten hesabınız var mı?{" "}
          <Link href="/signin" className="font-semibold text-blue-600 hover:text-blue-700">
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
          belowField={
            password.length > 0 && (
              <>
                {/* #153: Kurallar görsel olarak işaretleniyordu ama ekran okuyucuya
                    hiç ulaşmıyordu. Sayaç aria-live ile özetleniyor; listenin
                    kendisi görsel destek olarak kalıyor. */}
                <p className="sr-only" aria-live="polite">
                  Şifre kurallarından {metCount} / {passwordRules.length} tanesi sağlandı.
                </p>
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1" aria-hidden="true">
                  {passwordRules.map((rule) => {
                    const ok = rule.test(password)
                    return (
                      <p
                        key={rule.label}
                        className={`flex items-center text-[11px] gap-1 ${ok ? "text-emerald-600" : "text-slate-400"}`}
                      >
                        <CheckCircle2
                          className={`w-3 h-3 shrink-0 ${ok ? "text-emerald-500" : "text-slate-300"}`}
                        />
                        {rule.label}
                      </p>
                    )
                  })}
                </div>
              </>
            )
          }
        />

        {state.error?.general && (
          <FormAlert variant="error">{state.error.general[0]}</FormAlert>
        )}

        <AuthSubmitButton
          pending={isPending}
          label="Hesap Oluştur"
          pendingLabel="Kayıt yapılıyor..."
        />
      </form>
    </AuthCard>
  )
}
