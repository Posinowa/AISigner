/**
 * Tüm seed kullanıcılarının şifrelerini sıfırlar.
 * Çalıştır: npx tsx scripts/reset-passwords.ts
 */
import { PrismaClient } from "@prisma/client";
import { hash, verify } from "@node-rs/argon2";

const prisma = new PrismaClient();
const NEW_PASSWORD = "geçici_şifre";

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: ["admin@example.com", "mentor@example.com", "student@example.com"] } },
    select: { id: true, email: true, role: true, password: true },
  });

  console.log(`${users.length} kullanıcı bulundu.\n`);

  for (const user of users) {
    // Mevcut şifre zaten doğruysa atla
    let alreadyValid = false;
    try {
      alreadyValid = await verify(user.password, NEW_PASSWORD);
    } catch {
      alreadyValid = false;
    }

    if (alreadyValid) {
      console.log(`✅ ${user.email} (${user.role}) — şifre zaten geçerli, atlanıyor`);
      continue;
    }

    const hashedPassword = await hash(NEW_PASSWORD);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    console.log(`🔄 ${user.email} (${user.role}) — şifre güncellendi`);
  }

  console.log("\n✅ Tamamlandı! Tüm hesaplar 'geçici_şifre' ile giriş yapabilir.");
}

main()
  .catch((e) => {
    console.error("❌ Hata:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
