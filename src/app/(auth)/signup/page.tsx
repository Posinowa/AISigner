"use client"

import { useState } from "react"
import { useActionState } from "react"
import { signupAction } from "./actions"
import { Eye, EyeOff, UserPlus, Loader2, CheckCircle2 } from "lucide-react"
import Link from "next/link"

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
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Kart */}
        <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-200/60 overflow-hidden">
          {/* Üst şerit */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="p-8 sm:p-10">
            {/* Başlık */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Hesap Oluştur</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Zaten hesabınız var mı?{" "}
                <Link href="/signin" className="font-semibold text-blue-600 hover:text-blue-700">
                  Giriş yapın
                </Link>
              </p>
            </div>

            <form action={formAction} className="space-y-5">
              {/* İsim + Soyad */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Ad</label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="given-name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                    placeholder="Adınız"
                  />
                  {state.error?.name && (
                    <p className="mt-1 text-xs text-red-500">{state.error.name[0]}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Soyad</label>
                  <input
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                    placeholder="Soyadınız"
                  />
                  {state.error?.lastName && (
                    <p className="mt-1 text-xs text-red-500">{state.error.lastName[0]}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                  placeholder="ornek@email.com"
                />
                {state.error?.email && (
                  <p className="mt-1 text-xs text-red-500">{state.error.email[0]}</p>
                )}
              </div>

              {/* Telefon (opsiyonel) */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Telefon <span className="text-slate-400 font-normal">(opsiyonel)</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                  placeholder="05xx xxx xx xx"
                />
                {state.error?.phone && (
                  <p className="mt-1 text-xs text-red-500">{state.error.phone[0]}</p>
                )}
              </div>

              {/* Şifre */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-11 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                    placeholder="En az 8 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <Eye className="w-4.5 h-4.5" /> : <EyeOff className="w-4.5 h-4.5" />}
                  </button>
                </div>
                {state.error?.password && (
                  <p className="mt-1 text-xs text-red-500">{state.error.password[0]}</p>
                )}

                {/* Şifre güç göstergesi */}
                {password.length > 0 && (
                  <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                    {passwordRules.map((rule) => {
                      const ok = rule.test(password)
                      return (
                        <p key={rule.label} className={`flex items-center text-[11px] gap-1 ${ok ? "text-emerald-600" : "text-slate-400"}`}>
                          <CheckCircle2 className={`w-3 h-3 shrink-0 ${ok ? "text-emerald-500" : "text-slate-300"}`} />
                          {rule.label}
                        </p>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Genel hata (rate-limit vb.) */}
              {state.error?.general && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                  {state.error.general[0]}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 font-semibold text-white shadow-md shadow-blue-200 transition-all focus:outline-none focus:ring-3 focus:ring-blue-300 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Kayıt yapılıyor...
                  </>
                ) : (
                  "Hesap Oluştur"
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Kayıt olarak{" "}
          <Link href="/terms" className="underline hover:text-slate-700">
            Kullanım Koşulları
          </Link>
          {"'nı kabul etmiş olursunuz."}
        </p>
      </div>
    </div>
  )
}
