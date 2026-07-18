import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/nextauth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/AppShell"

// 🔐 Bu layout, sadece mentor rolüne sahip kullanıcıların erişebileceği sayfaları korur.

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/signin")
  }

  if (session.user.role !== "MENTOR") {
    redirect("/")
  }

  return (
    <>
      <AppShell role="MENTOR" />
      {children}
    </>
  )
}
