"use client"

import { useSession, signOut, signIn } from "next-auth/react"
import { useEffect } from "react"

// 🔍 Bu sayfa, oturum (session) verisini test etmek ve gözlemlemek için açıldı.
// Amaç: Giriş yapıldığında session objesinin içeriğini görmek, çıkış yapıldığında silindiğini doğrulamak.

export default function DebugPage() {
  const { data: session, status } = useSession()

  // 🧪 Oturum verisini tarayıcı konsoluna yazdırıyoruz.
  // Böylece JWT içeriğini ve session objesini doğrudan görebiliyoruz
  useEffect(() => {
    console.log("Session verisi:", session)
  }, [session])

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🔍 Debug Sayfası</h1>

      {status === "loading" && <p>Yükleniyor...</p>}

      {status === "unauthenticated" && (
        <>
          <p>Giriş yapılmamış. Lütfen <a href="/signin">giriş yap</a>.</p>
          <button onClick={() => signIn()}>Giriş Yap</button>
        </>
      )}

         {/* ✅ Giriş yapılmışsa */}
         
      {status === "authenticated" && session && (
        <>
          <p><strong>Kullanıcı:</strong> {session.user?.email}</p>
          <p><strong>Rol:</strong> {session.user?.role ?? "Tanımsız"}</p>
          <button onClick={() => signOut({ callbackUrl: "/signin" })}>
            Çıkış Yap
          </button>
        </>
      )}
    </div>
  )
}
