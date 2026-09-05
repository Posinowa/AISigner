import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { seedProjectTemplates } from "./seed-projects";
import { bireyselTekilKey } from "../src/features/projects/tekil-anahtar";

const prisma = new PrismaClient();

// #56: Tek komutla (npm run seed) admin/mentor/student kullanıcıları, mentor-stajyer
// ataması ve örnek proje şablonları oluşturan birleşik demo seed akışı. Tüm adımlar
// upsert/varlık-kontrolü ile idempotent — tekrar çalıştırmak duplicate üretmez.
async function main() {
  // #216 review: Seed artık demo hesapların şifre/rol/accountStatus'unu EZİYOR.
  // Bu yıkıcı davranış prod/staging'de kazara çalışırsa, zayıf ve bilinen bir
  // parolayla ONAYLI ADMIN hesabı üretir (arka kapı). DEPLOYMENT.md uyarısı bir
  // SÜREÇ kontrolüdür; burada KOD kontrolü şart.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "❌ Seed production ortamında çalıştırılamaz — demo hesapların şifresini/rolünü ezer.\n" +
        "   Gerçek yönetici hesabı için: npm run create:admin (bkz. #206 / DEPLOYMENT.md)",
    );
    process.exit(1);
  }

  const users: { email: string; name: string; role: "ADMIN" | "MENTOR" | "STUDENT" }[] = [
    { email: "admin@example.com", name: "Admin User", role: "ADMIN" },
    { email: "mentor@example.com", name: "Mentor User", role: "MENTOR" },
    { email: "student@example.com", name: "Student User", role: "STUDENT" },
  ];

  // #216: Demo şifresi `DEMO_PASSWORD` env'inden okunur; verilmezse yerleşik
  // geliştirme varsayılanı kullanılır. (Seed YALNIZ yereldir — prod'da gerçek
  // yönetici için `npm run create:admin` kullanılır, bkz. DEPLOYMENT.md.)
  //
  // ⚠️ Varsayılan DEĞİŞTİRİLMEZ: README, CONTRIBUTING ve scripts/reset-passwords.ts
  // bu değeri belgeler. Değiştirilecekse hepsi AYNI commit'te güncellenmelidir.
  const DEFAULT_DEMO_PASSWORD = "geçici_şifre";
  const passwordFromEnv = Boolean(process.env.DEMO_PASSWORD);
  const password = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;
  const hashedPassword = await hash(password);

  for (const user of users) {
    // Idempotent işlem: upsert kullanıyoruz (mevcutsa şifre ve APPROVED durumunu tazele)
    await prisma.user.upsert({
      where: { email: user.email }, // Benzersiz email kontrolü
      update: {
        password: hashedPassword,
        role: user.role,
        accountStatus: "APPROVED",
        // Demo hesapları APPROVED açılıyor; e-posta doğrulaması artık onayın
        // ÖN KOŞULU olduğu için (features/admin/server/user.ts) doğrulanmış
        // sayılmaları gerekiyor. Aksi halde yerelde bir demo hesabı PENDING'e
        // alıp tekrar onaylamak imkânsız olurdu.
        emailVerified: new Date(),
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role, // schema.prisma'daki Role enum'una göre
        password: hashedPassword, // string hash
        accountStatus: "APPROVED",
        emailVerified: new Date(),
      },
    });
    // Güvenlik: env'den GELEN şifre loglanmaz (terminal/CI çıktısına sızmasın);
    // yalnız yerleşik varsayılan gösterilir.
    console.log(
      `✅ ${user.role} user ready: ${user.email} (şifre: ${
        passwordFromEnv ? "DEMO_PASSWORD env'inden" : password
      })`,
    );
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

  const demoProfile = await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {},
    create: {
      userId: student.id,
      experienceLevel: "BEGINNER", // #54: kanonik UPPERCASE
      interests: ["Web Development"],
      goals: "Demo amaçlı örnek stajyer profili — full-stack bir proje geliştirmeyi hedefliyor.",
      availability: "part-time",
      birthYear: 2002,
    },
  });

  // #195: Mentor ataması artık M:N join tablosunda (idempotent — @@unique).
  await prisma.mentorAssignment.upsert({
    where: {
      studentProfileId_mentorId: {
        studentProfileId: demoProfile.id,
        mentorId: mentor.id,
      },
    },
    update: {},
    create: { studentProfileId: demoProfile.id, mentorId: mentor.id },
  });
  console.log(`✅ Student, mentor'a atandı: student@example.com → mentor@example.com`);

  // #56: Proje şablonlarını (idempotent) oluştur.
  await seedProjectTemplates(prisma);

  // Demo için student@example.com kullanıcısına bir proje atayalım ve örnek roadmap ekleyelim
  const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: student.id },
  });
  const firstTemplate = await prisma.projectTemplate.findFirstOrThrow();

  // #503: Bileşik tekillik `tekilKey`e taşındı (koşullu tekillik — bkz.
  // `projects/tekil-anahtar.ts`). Seed idempotent kalsın diye upsert aynı
  // anahtar üzerinden yapılıyor.
  const seedTekilKey = bireyselTekilKey(studentProfile.id, firstTemplate.id);
  const assignedProject = await prisma.assignedProject.upsert({
    where: { tekilKey: seedTekilKey },
    update: {},
    create: {
      studentProfileId: studentProfile.id,
      projectTemplateId: firstTemplate.id,
      status: "IN_PROGRESS",
      tekilKey: seedTekilKey,
    },
  });

  const roadmap = await prisma.roadmap.upsert({
    where: { assignedProjectId: assignedProject.id },
    update: {},
    create: {
      assignedProjectId: assignedProject.id,
      title: `${firstTemplate.title} Yol Haritası`,
      status: "PUBLISHED",
    },
  });

  const existingSteps = await prisma.roadmapStep.count({ where: { roadmapId: roadmap.id } });
  if (existingSteps === 0) {
    await prisma.roadmapStep.createMany({
      data: [
        {
          roadmapId: roadmap.id,
          order: 1,
          title: "Faz 1: Proje Kurulumu ve Şema Tasarımı",
          description: "Next.js ve PostgreSQL veritabanı altyapısının kurulması.",
          status: "COMPLETED",
          resources: ["https://nextjs.org/docs"],
        },
        {
          roadmapId: roadmap.id,
          order: 2,
          title: "Faz 2: Kimlik Doğrulama ve Kullanıcı Yönetimi",
          description: "Argon2 ve NextAuth ile giriş kayıt sisteminin geliştirilmesi.",
          status: "IN_PROGRESS",
          resources: ["https://next-auth.js.org"],
        },
        {
          roadmapId: roadmap.id,
          order: 3,
          title: "Faz 3: Portföy Bileşenleri ve Canlıya Alma",
          description: "Projelerin listelenmesi, responsive tasarım ve Docker ile deploy.",
          status: "TODO",
          resources: ["https://docker.com"],
        },
      ],
    });
  }

  console.log("\n🎉 Seed tamamlandı — admin/mentor/student kullanıcıları, mentor-stajyer ataması, demo proje ataması ve proje şablonları hazır.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
