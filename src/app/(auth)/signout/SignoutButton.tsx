
//  Amaç: Kullanıcı çıkış yaptığında oturumu sonlandırmak ve giriş sayfasına yönlendirmek.
"use client"
import { signOut } from "next-auth/react"

export function SignoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/signin" })}>
      Çıkış Yap
    </button>
  )
}
 //Sign out işlemi server action olarak değil, client-side component üzerinden gerçekleştirilir.
//next-auth/react’in signOut fonksiyonu tarayıcı ortamında çalışmak üzere tasarlanmıştır.
//Bu fonksiyon, tarayıcıda session cookie’lerini temizler ve yönlendirme (callbackUrl) yapar.
//Server action ("use server") içinde çalıştırılamaz çünkü Next.js server context’inde tarayıcıya ait cookie/session ve redirect mekanizması bulunmaz.