
//AMAÇ:Bu sunucu tarafı fonksiyon, gelen form verisini doğrulayıp kullanıcıyı veritabanına ekler ve kayıt başarılıysa giriş sayfasına yönlendirir.
"use server"
import { prisma } from "@/lib/auth/prisma"
import { hash } from "@node-rs/argon2"
import { signupSchema } from "@/features/auth/models/user"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createRateLimiter } from "@/lib/rate-limit"
import { sendVerificationEmail } from "@/features/auth/server/email-verification"

const signupLimiter = createRateLimiter("signup", {
  maxRequests: 5,
  windowSeconds: 300, // 5 dakikada max 5 kayıt denemesi
});

// Başarılı durumda function redirect() ile NEXT_REDIRECT throw eder, asla return etmez.
// Bu yüzden state sadece error tutar.
export type SignupState = { error: Record<string, string[]> };

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  // Rate limiting
  const headersList = await headers();
  const ip =
    headersList.get("x-real-ip") ||
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous";
  const rl = signupLimiter.check(ip);
  if (!rl.allowed) {
    return { error: { email: ["Çok fazla kayıt denemesi. Lütfen 5 dakika bekleyin."] } };
  }

  const name = formData.get("name") as string
  const lastName = formData.get("lastName") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  // Telefon opsiyonel: boşsa undefined gönder
  const phoneRaw = formData.get("phone") as string | null
  const phone = phoneRaw?.trim() || undefined

  const parsed = signupSchema.safeParse({ name, lastName, email, password, phone })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  // Email normalizasyonu (enumeration önleme)
  const normalizedEmail = email.toLowerCase().trim();

  // DB işlemlerini try/catch ile sarmal — beklenmeyen hatalarda kullanıcıya
  // dump edilen Prisma stack yerine düzgün bir mesaj göster.
  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) return { error: { email: ["Bu email zaten kayıtlı"] } }

    const hashedPassword = await hash(password)
    const yeniKullanici = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        lastName: parsed.data.lastName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: parsed.data.phone ?? null,
        role: "STUDENT",
        // Yeni stajyer hesabı admin onayına kadar PENDING — aktif değildir.
        accountStatus: "PENDING",
      },
      select: { id: true, name: true },
    })

    // #247: Doğrulama e-postası. Gönderilemezse kayıt AKIŞI KIRILMAZ —
    // hesap oluşmuş olur, kullanıcı doğrulamayı sonra yapabilir.
    await sendVerificationEmail({
      userId: yeniKullanici.id,
      email: normalizedEmail,
      name: yeniKullanici.name,
    })
  } catch (err) {
    // redirect() Next.js'te NEXT_REDIRECT throw eder — onu yakalayıp swallow etmemeliyiz
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("signupAction failed:", err)
    return {
      error: {
        general: [
          "Kayıt sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        ],
      },
    }
  }

  // Başarılı -> redirect (try/catch dışında, NEXT_REDIRECT throw etsin)
  redirect("/signin?registered=true")
}
