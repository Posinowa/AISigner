
//AMAÇ:Kullanıcının giriş formundaki email ve şifre bilgilerini doğrulayıp, geçerli ise signIn işlemine geçilmesini sağlamak için sunucu tarafında çalışan bir kontrol mekanizmasıdır.

"use server"
import { prisma } from "@/lib/auth/prisma"
import { verify } from "@node-rs/argon2"
import { signinSchema } from "@/features/auth/models/user"

export async function validateUser(formData: FormData) {
  // Form verilerini al
  const email = formData.get("email") as string
  const password = formData.get("password") as string

    // Zod ile form verisini doğrula
  // Amaç: eksik veya geçersiz alanları erken aşamada yakalamak
  const parsed = signinSchema.safeParse({ email, password })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Veritabanında kullanıcıyı email ile ara
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return { error: { email: ["Kullanıcı bulunamadı"] } }

    // Şifreyi Argon2 ile doğrula
  const isValid = await verify(user.password, password)
  if (!isValid) return { error: { password: ["Şifre yanlış"] } }
  
  // Not: Burada session oluşturulmaz, sadece doğrulama yapılır
  return { ok: true }
}

