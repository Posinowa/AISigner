"use client"
import { SessionProvider as NextAuthProvider } from "next-auth/react"
import type { Session } from "next-auth"

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode
  session?: Session
}) {
  return <NextAuthProvider session={session}>{children}</NextAuthProvider>
}
