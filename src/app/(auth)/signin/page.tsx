//AMAÇ:Kullanıcının giriş bilgilerini doğrulayıp NextAuth üzerinden oturum başlatmak ve hataları kullanıcıya göstermek için hazırlanmış client-side form bileşenidir.
"use client"

import { Suspense, useState } from "react"
import { validateUser } from "./actions"
import { signIn, getSession } from "next-auth/react"
import { Eye, EyeOff, LogIn, Loader2, CheckCircle2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

const initialState = { error: {} as Record<string, string[]> }

// useSearchParams Suspense boundary gerektiriyor — iç bileşene taşındı
function SigninForm() {
  const [state, setState] = useState(initialState)
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const searchParams = useSearchParams()
  const justRegistered = searchParams.get("registered") === "true"

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState(initialState)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)

    try {
      const res = await validateUser(formData)
      if (res?.error) {
        setState({ error: res.error })
        return
      }

      // Email'i normalize et (validateUser ile aynı kural)
      const email = (formData.get("email") as string)?.toLowerCase().trim() ?? ""
      const password = formData.get("password") as string

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setState({ error: { general: ["E-posta veya şifre hatalı! Lütfen tekrar deneyin."] } })
      } else if (result?.ok) {
        // Session cookie'sinin oturduğundan emin olmak için kısa bir bekleme + retry
        let userRole: string | undefined
        for (let i = 0; i < 5; i++) {
          const session = await getSession()
          userRole = session?.user?.role
          if (userRole) break
          await new Promise((r) => setTimeout(r, 100))
        }

        const target =
          userRole === "ADMIN"
            ? "/admin-dashboard"
            : userRole === "MENTOR"
            ? "/mentor-dashboard"
            : "/student-dashboard"

        // Hard navigation: cookie'lerin server'a temiz şekilde gitmesini garanti et
        window.location.href = target
        return
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu"
      setState({
        error: { general: [message] },
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Kart */}
        <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-200/60 overflow-hidden">
          {/* Üst şerit */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="p-8 sm:p-10">
            {/* Başlık */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <LogIn className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {justRegistered ? "Hoş Geldiniz!" : "Tekrar Hoşgeldiniz"}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Hesabınız yok mu?{" "}
                <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                  Kayıt olun
                </Link>
              </p>
            </div>

            {/* Kayıt başarı banner'ı */}
            {justRegistered && (
              <div className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Hesabınız başarıyla oluşturuldu!</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Şimdi e-posta ve şifrenizle giriş yapabilirsiniz.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                  placeholder="ornek@email.com"
                />
                {state.error?.email && (
                  <p className="mt-1 text-xs text-red-500">{state.error.email[0]}</p>
                )}
              </div>

              {/* Şifre */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700">Şifre</label>
                  <Link href="/forgot-password" className="text-xs font-medium text-amber-600 hover:text-amber-700">
                    Şifremi Unuttum
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-11 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                    placeholder="Şifrenizi girin"
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
              </div>

              {/* Genel hata */}
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
                    Giriş yapılıyor...
                  </>
                ) : (
                  "Giriş Yap"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// Suspense boundary — useSearchParams için zorunlu (Next.js 15)
export default function SigninPage() {
  return (
    <Suspense fallback={null}>
      <SigninForm />
    </Suspense>
  )
}
