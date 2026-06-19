// 🔧 Bu dosya, NextAuth'un varsayılan tiplerini genişletmek için kullanılır.
// Amaç: session, JWT ve user objelerine özel alanlar ekleyerek TypeScript desteğini tam hale getirmek.

import NextAuth from "next-auth"

declare module "next-auth" {
  
  interface Session {
    sessionToken?: string
    user: {
      id?: string
      name?: string
      email?: string
      role?: string
      accountStatus?: string
    }
  }

  interface JWT {
    id?: string
    sessionToken?: string
    role?: string
    accountStatus?: string
  }

  interface User {
    id?: string
    role?: string
    accountStatus?: string
  }
}
