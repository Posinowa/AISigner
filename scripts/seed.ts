import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { log } from "console";

const prisma = new PrismaClient();

async function main() {
  // Örnek kullanıcılar - roller: ADMIN, MENTOR, STUDENT
  const users = [
    { email: "admin@example.com", name: "Admin User", role: "ADMIN" },
    { email: "mentor@example.com", name: "Mentor User", role: "MENTOR" },
    { email: "student@example.com", name: "Student User", role: "STUDENT" },
  ];

  for (const user of users) {



    // Şifreyi hashle (argon2 ile)
  const password = 'geçici_şifre';
  const hashedPassword = await hash(password);



    // Idempotent işlem: upsert kullanıyoruz
    await prisma.user.upsert({
      where: { email: user.email }, // Benzersiz email kontrolü
      update: {}, // Eğer varsa güncelleme yapma
      create: {
        email: user.email,
        name: user.name,
        role: user.role as any, // schema.prisma'daki Role enum'una göre
        password: hashedPassword, // string hash
      },
    });


    
    console.log(`✅ ${user.role} user created: ${user.email}`);
  }

  console.log("Seed process completed! 3 users added!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });