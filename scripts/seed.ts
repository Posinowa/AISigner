import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { seedProjectTemplates } from "./seed-projects";

const prisma = new PrismaClient();

// #56: Tek komutla (npm run seed) admin/mentor/student kullanıcıları, mentor-stajyer
// ataması ve örnek proje şablonları oluşturan birleşik demo seed akışı. Tüm adımlar
// upsert/varlık-kontrolü ile idempotent — tekrar çalıştırmak duplicate üretmez.
async function main() {
  const users: { email: string; name: string; role: "ADMIN" | "MENTOR" | "STUDENT" }[] = [
    { email: "admin@example.com", name: "Admin User", role: "ADMIN" },
    { email: "mentor@example.com", name: "Mentor User", role: "MENTOR" },
    { email: "student@example.com", name: "Student User", role: "STUDENT" },
  ];

  const password = "geçici_şifre";
  const hashedPassword = await hash(password);

  for (const user of users) {
    // Idempotent işlem: upsert kullanıyoruz
    await prisma.user.upsert({
      where: { email: user.email }, // Benzersiz email kontrolü
      update: {}, // Eğer varsa güncelleme yapma
      create: {
        email: user.email,
        name: user.name,
        role: user.role, // schema.prisma'daki Role enum'una göre
        password: hashedPassword, // string hash
      },
    });
    console.log(`✅ ${user.role} user created: ${user.email}`);
  }

  // #56: Student'ı mentor'a ata + demo için gerçekçi bir profil oluştur.
  // StudentProfile.userId @unique olduğu için upsert idempotent.
  const mentor = await prisma.user.findUniqueOrThrow({
    where: { email: "mentor@example.com" },
    select: { id: true },
  });
  const student = await prisma.user.findUniqueOrThrow({
    where: { email: "student@example.com" },
    select: { id: true },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: { mentorId: mentor.id },
    create: {
      userId: student.id,
      mentorId: mentor.id,
      experienceLevel: "BEGINNER", // #54: kanonik UPPERCASE
      interests: ["Web Development"],
      goals: "Demo amaçlı örnek stajyer profili — full-stack bir proje geliştirmeyi hedefliyor.",
      availability: "part-time",
      birthYear: 2002,
    },
  });
  console.log(`✅ Student, mentor'a atandı: student@example.com → mentor@example.com`);

  // #56: Proje şablonlarını (idempotent) oluştur.
  await seedProjectTemplates(prisma);

  console.log("\n🎉 Seed tamamlandı — admin/mentor/student kullanıcıları, mentor-stajyer ataması ve proje şablonları hazır.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
