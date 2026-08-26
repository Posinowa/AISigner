// 🔧 Bu dosya, NextAuth'un varsayılan tiplerini genişletmek için kullanılır.
// Amaç: session, JWT ve user objelerine özel alanlar ekleyerek TypeScript desteğini tam hale getirmek.

// Modül augmentation için yan-etkili import yeterli; default binding kullanılmıyordu.
import "next-auth"

declare module "next-auth" {
  
  interface Session {
    sessionToken?: string
    user: {
      id?: string
      name?: string
      email?: string
      role?: string
      accountStatus?: string
      // #259: Dolu ise e-postasi dogrulanmis hesap. ISO tarih string'i.
      emailVerified?: string | null
    }
  }

  interface JWT {
    id?: string
    sessionToken?: string
    role?: string
    accountStatus?: string
    emailVerified?: string | null
  }

  interface User {
    id?: string
    role?: string
    accountStatus?: string
  }
}
