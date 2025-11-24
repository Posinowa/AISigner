import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/nextauth"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  // Giriş yapılmamışsa → signin sayfasına yönlendir
  if (!session?.user) redirect("/signin")

  // Rol admin değilse → anasayfaya yönlendir
  if (session.user.role !== "ADMIN") redirect("/")

  return <>{children}</>
}
