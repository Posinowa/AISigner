import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/nextauth"
import { redirect } from "next/navigation"
import { AIChatBot } from "@/features/ai/ui/AIChatBot"
import { AppShell } from "@/components/AppShell"

// 🔐 Bu layout, sadece student rolüne sahip kullanıcıların erişebileceği sayfaları korur.

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/signin")
  }

  if (session.user.role !== "STUDENT") {
    redirect("/")
  }

  return (
    <>
      <AppShell role="STUDENT" />
      {children}
      <AIChatBot />
    </>
  )
}
