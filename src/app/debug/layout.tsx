// src/app/debug/layout.tsx
"use client"
import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"

export default function DebugLayout({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
