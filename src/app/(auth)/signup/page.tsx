
//AMAç:Bu sayfa, kullanıcıdan alınan kayıt bilgilerini signupAction ile işleyip doğrulama hatalarını göstererek güvenli bir şekilde yeni kullanıcı oluşturmayı amaçlar.

"use client"

import { useState } from "react"
import { useActionState } from "react"
import { signupAction } from "./actions"
import { Eye, EyeOff } from "lucide-react";
import { UserPlus } from "lucide-react"




const initialState = { error: {} as Record<string, string[]> }

export default function SignupPage() {
  const [state, formAction] = useActionState(signupAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-4 py-12"
>
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-gray-200">
        {/* Logo veya Başlık */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-600 flex items-center justify-center shadow-md">
             <UserPlus className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Kayıt Ol</h1>
          <p className="mt-2 text-sm text-gray-500">
            Hesabınızı oluşturmak için bilgilerinizi girin
          </p>
        </div>

        <form action={formAction} className="space-y-6">
          {/* İsim */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              İsim
            </label>
            <input
              type="text"
              name="name"
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100 outline-none transition"
            />
            {state.error?.name && (
              <p className="mt-2 text-sm text-red-500">{state.error.name[0]}</p>
            )}
          </div>

           {/* Soyadı */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Soyadı
            </label>
            <input
              type="text"
              name="lastName"
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100 outline-none transition"
            />
            {state.error?.name && (
              <p className="mt-2 text-sm text-red-500">{state.error.lastName[0]}</p>
            )}
          </div>


          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100 outline-none transition"
            />
            {state.error?.email && (
              <p className="mt-2 text-sm text-red-500">{state.error.email[0]}</p>
            )}
          </div>

          {/* Telefon Numarası */}
           <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
             Telefon Numaranız
            </label>
             <input
               type="tel"
               name="phone"
               className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100 outline-none transition"
               placeholder="05xx xxx xx xx"
            />
        {state.error?.phoneNumber && (
         <p className="mt-2 text-sm text-red-500">{state.error.phoneNumber[0]}</p>
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
                className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 pr-10 text-gray-800 shadow-sm focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <Eye className="w-5 h-5" /> :<EyeOff className="w-5 h-5" />}
              </button>
            </div>
            {state.error?.password && (
              <p className="mt-2 text-sm text-red-500">{state.error.password[0]}</p>
            )}
          </div>

          {/* Genel hata */}
          {typeof state.error === "string" && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 shadow-inner">
              {state.error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-2xl bg-green-600 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-green-700 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-green-200"
          >
            Kayıt Ol
          </button>
        </form>

        {/* Alt link */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Zaten hesabınız var mı?{" "}
            <a
              href="/signin"
              className="font-medium text-green-600 hover:text-green-700"
            >
              Giriş Yap
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
