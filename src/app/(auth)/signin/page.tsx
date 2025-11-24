
//AMAÇ:Kullanıcının giriş bilgilerini doğrulayıp NextAuth üzerinden oturum başlatmak ve hataları kullanıcıya göstermek için hazırlanmış client-side form bileşenidir.
"use client"

import { useState } from "react"
import { validateUser } from "./actions"
import { signIn } from "next-auth/react"
import { Eye, EyeOff } from "lucide-react";
import { Lock } from "lucide-react"


const initialState = { error: {} as Record<string, string[]> }

export default function SigninPage() {
  const [state, setState] = useState(initialState)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState(initialState)

    const formData = new FormData(e.currentTarget)

    try {
      const res = await validateUser(formData)
      if (res?.error) {
        setState({ error: res.error })
        return
      }

      const result = await signIn("credentials", {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        redirect: false,
      })

      if (result?.ok) window.location.href = "/"
      else setState({ error: { general: ["Giriş yapılamadı"] } })
    } catch (err: any) {
      setState({
        error: { general: [err.message || "Bilinmeyen bir hata oluştu"] },
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-gray-200">
        {/* Logo veya Başlık */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center shadow-md">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">
            Hesabınıza Giriş Yapın
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Lütfen bilgilerinizi girin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition"
              required
            />
            {state.error?.email && (
              <p className="mt-2 text-sm text-red-500">
                {state.error.email[0]}
              </p>
            )}
          </div>

          {/* Şifre + Göster/Gizle */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Şifre
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 pr-10 text-gray-800 shadow-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <Eye className="w-5 h-5" /> :<EyeOff className="w-5 h-5" /> }
              </button>
            </div>
            {state.error?.password && (
              <p className="mt-2 text-sm text-red-500">
                {state.error.password[0]}
              </p>
            )}
          </div>

          {/* Genel hata */}
          {state.error?.general && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 shadow-inner">
              {state.error.general[0]}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            Giriş Yap
          </button>
        </form>

        {/* Alt linkler */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Hesabınız yok mu?{" "}
            <a
              href="/signup"
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Kayıt Ol
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
