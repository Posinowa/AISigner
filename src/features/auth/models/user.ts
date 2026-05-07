import { z } from "zod"

/**
 * Paylaşılan şifre kuralları — hem kayıt hem giriş doğrulamasında kullanılır.
 * Böylece şifre politikası tek yerden yönetilir.
 */
export const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .max(128, "Şifre en fazla 128 karakter olabilir")
  .regex(/[A-Z]/, "Şifre en az bir büyük harf içermeli")
  .regex(/[a-z]/, "Şifre en az bir küçük harf içermeli")
  .regex(/[0-9]/, "Şifre en az bir rakam içermeli")
  .regex(/[^A-Za-z0-9]/, "Şifre en az bir özel karakter içermeli")

export const signupSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı"),
  lastName: z.string().min(2, "Soyad en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir email girin"),
  password: passwordSchema,
  phone: z.string().optional()
})

export const signinSchema = z.object({
  email: z.string().email("Geçerli bir email girin"),
  // Giriş sırasında karmaşıklık kuralı uygulanmaz — asıl doğrulama NextAuth
  // authorize() içinde argon2.verify() ile DB hash'e karşı yapılır.
  password: z.string().min(1, "Şifre boş bırakılamaz"),
})
