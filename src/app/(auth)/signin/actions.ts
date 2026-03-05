
//AMAÇ: Giriş formundaki email ve şifre alanlarını Zod ile doğrulamak.
// Asıl kimlik doğrulama (şifre kontrolü) NextAuth authorize() callback'inde yapılır.

"use server"
import { signinSchema } from "@/features/auth/models/user"

export async function validateUser(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  // Zod ile form verisini doğrula (eksik/geçersiz alanları erken yakala)
  const parsed = signinSchema.safeParse({ email, password })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  
  return { ok: true }
}

