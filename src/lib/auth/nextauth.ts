
import type { AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials" // NextAuth için Credentials provider (email & password ile giriş)
import { prisma } from "@/lib/auth/prisma" // Prisma Client instance (db erişimi için)
import { verify } from "@node-rs/argon2"; // Şifreleri doğrulamak için argon2 verify metodu
import { PrismaAdapter } from "@next-auth/prisma-adapter"; // Prisma ile NextAuth’u bağlayan adapter


// NextAuth konfigürasyonu
export const authOptions : AuthOptions = {
     adapter: PrismaAdapter(prisma),  // Kullanıcı, session, account, verificationToken tablolarını Prisma üzerinden yönetmek için adapter
  session: { strategy: "jwt"},

  
  secret: process.env.AUTH_SECRET, // Session ve JWT tokenleri imzalamak için kullanılacak secret
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
  // JWT oluşturulurken çalışır
   // Amaç: Kullanıcı giriş yaptığında, onun bilgilerini token içine eklemek
   
    async jwt({ token, user }) {
      if (user) {
        // Kullanıcı giriş yaptıysa, token içine email ve rolünü ekliyoruz
        token.id = user.id
        token.email = user.email
        token.role = user.role
        
        // Prisma ile kullanıcıya ait en son session token'ını alıp token içine ekliyoruz
        token.sessionToken = (await prisma.session.findFirst({
          where: { userId: user.id },
          orderBy: { expires: "desc" }
        }))?.sessionToken
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
