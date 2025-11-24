
//AMAÇ:Bu sunucu tarafı fonksiyon, gelen form verisini doğrulayıp kullanıcıyı veritabanına ekler ve kayıt başarılıysa giriş sayfasına yönlendirir.
"use server"
import { prisma } from "@/lib/auth/prisma"
import { hash } from "@node-rs/argon2"
import { signupSchema } from "@/features/auth/models/user"
import { redirect } from "next/navigation"

export async function signupAction(
  prevState: any,
  formData: FormData
): Promise<any> {
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

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: { email: ["Bu email zaten kayıtlı"] } }

  const hashedPassword = await hash(password)
  await prisma.user.create({
    data: { name , lastName , email, password: hashedPassword, phone,  role: "STUDENT" },
  })

  // Başarılı -> redirect
  redirect("/signin")
}
