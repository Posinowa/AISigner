import { z } from "zod"

export const signupSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmali"),
  lastName: z.string().min(2, "Soyad en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir email girin"),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .regex(/[A-Z]/, "Şifre en az bir büyük harf içermeli")
    .regex(/[a-z]/, "Şifre en az bir küçük harf içermeli")
    .regex(/[0-9]/, "Şifre en az bir rakam içermeli")
    .regex(/[^A-Za-z0-9]/, "Şifre en az bir özel karakter içermeli"),
  phone: z.string().min(10, "Telefon numarası geçersiz")
})

export const signinSchema = z.object({
  email: z.string().email("Geçerli bir email girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmali"),
})
