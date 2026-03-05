
import type { AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/auth/prisma"
import { verify } from "@node-rs/argon2";


// AUTH_SECRET kontrolü - üretim ortamında eksikse hata fırlat
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET ortam değişkeni üretim ortamında tanımlanmalıdır!");
}

// NextAuth konfigürasyonu
export const authOptions : AuthOptions = {
  session: { strategy: "jwt"},

  
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials", // Login ekranında provider adı
      credentials: {
        email: { label: "Email", type: "text" },// Form input: Email
        password: { label: "Password", type: "password" },// Form input: Password
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null // Eğer kullanıcı email veya password göndermediyse null dön
 
        // DB’den user bul (email ile arama)
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) return null
        
        // Argon2 ile hash’lenmiş şifreyi kontrol et
                // verify(hash, plainPassword) şeklinde çalışır

        const isValid = await verify(user.password, credentials.password); // ✅ verify(hash, plain)

        return isValid ? user : null
      },
    }),
  ],
   cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,  // JS tarafından erişilemez (XSS koruması)
        sameSite: "lax"as const,  // CSRF koruması için SameSite=Lax
        path: "/", // Her yerde geçerli
        secure: process.env.NODE_ENV === "production", // Prod ortamında HTTPS şart
      },
    },
  },
  
 
callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = user.role
      }
      return token
    },
   
     // Client tarafında session alınırken çalışır
    async session({ session, token }) {

       // JWT'den gelen bilgileri session.user içine kopyalıyoruz
      session.user = {
        ...session.user,
        id: token.id as string | undefined,
        email: token.email?? "",
        role: typeof token.role === "string" ? token.role : undefined,
        
      }
      return session
    },
  },


}
