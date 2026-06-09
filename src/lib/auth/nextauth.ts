
import type { AuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/auth/prisma"
import { hash, verify } from "@node-rs/argon2";
import { createRateLimiter } from "@/lib/rate-limit";


// AUTH_SECRET kontrolü - üretim ortamında eksikse hata fırlat
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET ortam değişkeni üretim ortamında tanımlanmalıdır!");
}

// Brute-force koruması: yalnızca BAŞARISIZ giriş denemeleri sayılır.
// E-posta başına sıkı, IP başına daha esnek (paylaşımlı NAT yanlış pozitiflerini azaltır).
const loginLimiterByEmail = createRateLimiter("login-email", {
  maxRequests: 5,
  windowSeconds: 600, // 10 dakikada 5 başarısız deneme
});
const loginLimiterByIp = createRateLimiter("login-ip", {
  maxRequests: 15,
  windowSeconds: 600, // 10 dakikada 15 başarısız deneme
});

// Timing/enumerasyon önleme: kullanıcı bulunamasa bile argon2'yi sabit bir
// hash'e karşı çalıştırırız ki yanıt süresi "kullanıcı var/yok" bilgisini sızdırmasın.
// Hash bir kez üretilip cache'lenir (top-level await'ten kaçınmak için lazy).
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hash("aisigner-dummy-password-for-constant-time-verify");
  }
  return dummyHashPromise;
}

function getClientIp(headers: Record<string, string | string[] | undefined> | undefined): string {
  const h = headers ?? {};
  const realIp = h["x-real-ip"];
  const realIpStr = Array.isArray(realIp) ? realIp[0] : realIp;
  if (realIpStr) return realIpStr.trim();
  const fwd = h["x-forwarded-for"];
  const fwdStr = Array.isArray(fwd) ? fwd[0] : fwd;
  if (fwdStr) return fwdStr.split(",")[0]!.trim();
  return "anonymous";
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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        // Email normalizasyonu — signup ile aynı kuralı uygula (case-insensitive)
        const normalizedEmail = credentials.email.toLowerCase().trim()

        const ip = getClientIp(req?.headers)
        const ipKey = `ip:${ip}`
        const emailKey = `email:${normalizedEmail}`

        // Bloke kontrolü (sayacı artırmadan): limit aşıldıysa pahalı işe girmeden reddet
        if (!loginLimiterByIp.peek(ipKey).allowed || !loginLimiterByEmail.peek(emailKey).allowed) {
          throw new Error("Çok fazla başarısız giriş denemesi. Lütfen birkaç dakika sonra tekrar deneyin.")
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })

        // Sabit zamanlı doğrulama: kullanıcı yoksa dummy hash'e karşı verify çalıştır
        const passwordHash = user?.password ?? (await getDummyHash())
        const isValid = await verify(passwordHash, credentials.password)

        if (!user || !isValid) {
          // Yalnızca başarısız denemeleri say
          loginLimiterByIp.check(ipKey)
          loginLimiterByEmail.check(emailKey)
          return null
        }

        // Başarılı giriş → sayaçları temizle (meşru kullanıcı cezalandırılmasın)
        loginLimiterByIp.reset(ipKey)
        loginLimiterByEmail.reset(emailKey)

        return user
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
