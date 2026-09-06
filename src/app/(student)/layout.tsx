import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/nextauth"
import { redirect } from "next/navigation"
import { AIChatBot } from "@/features/ai/ui/AIChatBot"
import { AppShell } from "@/components/AppShell"
import { AdimKutlamasi } from "@/features/roadmap/ui/AdimKutlamasi"

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
      <AppShell role="STUDENT" mezun={session.user.accountStatus === "GRADUATED"} />
      {/* #329: Adım tamamlandığında (ör. #326 webhook'u ile) anında kutlama. */}
      <AdimKutlamasi />
      {children}
      <AIChatBot />
    </>
  )
}
