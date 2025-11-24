import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth/nextauth" // ← NextAuth config import

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
