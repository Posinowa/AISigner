/**
 * #206: Güvenli ilk-admin oluşturma (prod deploy).
 *
 * Prod'da `npm run seed` ÇALIŞTIRILMAZ (zayıf demo admin: admin@example.com).
 * Gerçek yönetici hesabını bu script ile oluştur. Kimlik bilgileri ORTAM
 * DEĞİŞKENİNDEN okunur — repoya hardcode EDİLMEZ, parola loglanmaz.
 *
 * Kullanım (dev makineden prod DB'ye, SSL ile):
 *   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require" \
 *   ADMIN_EMAIL="admin@posinowa.com" \
 *   ADMIN_PASSWORD="<güçlü-parola>" \
 *   npx tsx scripts/create-admin.ts
 *
 * Idempotent: aynı e-posta ile tekrar çalıştırılırsa parolayı günceller
 * (ADMIN rolüne + APPROVED durumuna çeker). Şifre sıfırlama için de kullanılabilir.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "✗ ADMIN_EMAIL ve ADMIN_PASSWORD ortam değişkenleri zorunludur.\n" +
        '  Örn: ADMIN_EMAIL="admin@posinowa.com" ADMIN_PASSWORD="<parola>" npx tsx scripts/create-admin.ts',
    );
    process.exit(1);
  }

  // Basit e-posta + parola sağlamlık kontrolü (prod admin zayıf olmasın).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("✗ Geçersiz e-posta biçimi.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("✗ Parola en az 10 karakter olmalı (prod için daha güçlüsü önerilir).");
    process.exit(1);
  }

  const hashed = await hash(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: "ADMIN", accountStatus: "APPROVED" },
    create: {
      email,
      password: hashed,
      role: "ADMIN",
      accountStatus: "APPROVED",
      name: "Yönetici",
    },
    select: { id: true, email: true, role: true },
  });

  // Parola ASLA loglanmaz.
  console.log(`✓ Admin hazır: ${user.email} (rol: ${user.role}). Artık bu hesapla giriş yapabilirsin.`);
}

main()
  .catch((e) => {
    console.error("✗ Admin oluşturma hatası:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
