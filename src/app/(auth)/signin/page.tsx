//AMAÇ:Kullanıcının giriş bilgilerini doğrulayıp NextAuth üzerinden oturum başlatmak ve hataları kullanıcıya göstermek için hazırlanmış client-side form bileşenidir.
"use client"

import { Suspense, useState } from "react"
import { validateUser } from "./actions"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AuthCard } from "@/features/auth/ui/AuthCard"
import { AuthField } from "@/features/auth/ui/AuthField"
import { FormAlert } from "@/features/auth/ui/FormAlert"
import { AuthSubmitButton } from "@/features/auth/ui/AuthSubmitButton"
import { dogrulamaMesaji } from "@/features/auth/ui/dogrulama-mesaji"

const initialState = { error: {} as Record<string, string[]> }

// useSearchParams Suspense boundary gerektiriyor — iç bileşene taşındı
function SigninForm() {
  const [state, setState] = useState(initialState)
  const [isPending, setIsPending] = useState(false)
  const searchParams = useSearchParams()
  const justRegistered = searchParams.get("registered") === "true"
  // #247: e-postadaki doğrulama bağlantısı kullanıcıyı buraya döndürür.
  const dogrulama = dogrulamaMesaji(searchParams.get("dogrulama"))

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
        // Yönlendirme kararı tek yerde — "/" route'unda (sunucu) — toplanıyor.
        // Hard navigation cookie'nin server'a temiz gitmesini garanti eder; böylece
        // client tarafında getSession retry hack'ine (yavaş ağda kırılgan) gerek kalmaz.
        window.location.href = "/"
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
    <AuthCard
      title={justRegistered ? "Hoş Geldiniz!" : "Tekrar Hoşgeldiniz"}
      subtitle={
        <>
          Hesabınız yok mu?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:text-primary/80 hover:underline">
            Kayıt olun
          </Link>
        </>
      }
    >
      {dogrulama && (
        <FormAlert variant={dogrulama.variant} title={dogrulama.title}>
          {dogrulama.body}
        </FormAlert>
      )}

      {justRegistered && (
        <FormAlert variant="success" title="Hesabınız başarıyla oluşturuldu!">
          Şimdi e-posta ve şifrenizle giriş yapabilirsiniz.
        </FormAlert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          id="signin-email"
          name="email"
          label="E-posta"
          type="email"
          autoComplete="email"
          required
          placeholder="ornek@email.com"
          errors={state.error?.email}
        />

        <AuthField
          id="signin-password"
          name="password"
          label="Şifre"
          revealable
          autoComplete="current-password"
          required
          placeholder="Şifrenizi girin"
          errors={state.error?.password}
          belowField={
            <div className="mt-1.5 text-right">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:text-primary/80 hover:underline"
              >
                Şifremi Unuttum
              </Link>
            </div>
          }
        />

        {state.error?.general && (
          <FormAlert variant="error">{state.error.general[0]}</FormAlert>
        )}

        <AuthSubmitButton
          pending={isPending}
          label="Giriş Yap"
          pendingLabel="Giriş yapılıyor..."
        />
      </form>
    </AuthCard>
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
