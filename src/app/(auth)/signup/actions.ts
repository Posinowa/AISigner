
//AMAÇ:Bu sunucu tarafı fonksiyon, gelen form verisini doğrulayıp kullanıcıyı veritabanına ekler ve kayıt başarılıysa giriş sayfasına yönlendirir.
"use server"
import { prisma } from "@/lib/auth/prisma"
import { hash } from "@node-rs/argon2"
import { signupSchema } from "@/features/auth/models/user"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createRateLimiter } from "@/lib/rate-limit"

const signupLimiter = createRateLimiter("signup", {
  maxRequests: 5,
  windowSeconds: 300, // 5 dakikada max 5 kayıt denemesi
});

export async function signupAction(
  prevState: any,
  formData: FormData
): Promise<any> {
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
  const phone = formData.get("phone") as string


  const parsed = signupSchema.safeParse({ name,lastName, email, password , phone })

  if (!parsed.success) {
    // Zod hata objesi döndür
    return { error: parsed.error.flatten().fieldErrors }
  }

  // Email normalizasyonu (enumeration önleme)
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) return { error: { email: ["Bu email zaten kayıtlı"] } }

  const hashedPassword = await hash(password)
  await prisma.user.create({
    data: { name , lastName , email: normalizedEmail, password: hashedPassword, phone,  role: "STUDENT" },
  })

  // Başarılı -> redirect
  redirect("/signin")
}
