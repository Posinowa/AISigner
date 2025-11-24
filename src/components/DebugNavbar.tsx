"use client"
import { useSession } from "next-auth/react"

export function DebugNavbar() {
  const { data: session } = useSession()

  return (
    <div className="p-4 text-sm text-gray-600 border-b bg-gray-50">
      {session?.user?.email ? (
        <p>
          <strong>Oturum:</strong> {session.user.email} | <strong>Rol:</strong> {session.user.role}
        </p>
      ) : (
        <p>Giriş yapılmamış</p>
      )}
    </div>
  )
}
