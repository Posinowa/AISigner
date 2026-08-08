import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  // Check user IDs
  const users = await p.user.findMany({ select: { id: true, email: true, role: true } });
  console.log("=== USERS ===");
  for (const u of users) {
    console.log(`  ${u.email} → ID: ${u.id} (${u.role})`);
  }

  const profiles = await p.studentProfile.findMany({
    include: {
      user: { select: { name: true, email: true } },
      // #195: M:N — atanmış mentorlar.
      mentorAssignments: { include: { mentor: { select: { email: true } } } },
      assignedProjects: {
        include: {
          projectTemplate: { select: { title: true } },
          roadmap: {
            include: { steps: { select: { id: true, title: true, order: true, status: true } } }
          }
        }
      }
    }
  });

  if (profiles.length === 0) {
    console.log("❌ Hiç StudentProfile yok!");
  }

  for (const p of profiles) {
    console.log(`\n👤 ${p.user.name} (${p.user.email})`);
    const mentorList = p.mentorAssignments.map((a) => a.mentor.email).join(", ") || "YOK";
    console.log(`   Profile ID: ${p.id}, Mentorlar: ${mentorList}`);
    
    if (p.assignedProjects.length === 0) {
      console.log("   📂 Atanmış proje yok");
    }
    
    for (const ap of p.assignedProjects) {
      console.log(`   📁 Proje: ${ap.projectTemplate.title} (${ap.status})`);
      if (ap.roadmap) {
        console.log(`      🗺️ Roadmap: ${ap.roadmap.title} (${ap.roadmap.status})`);
        console.log(`      📊 Adım sayısı: ${ap.roadmap.steps.length}`);
        for (const s of ap.roadmap.steps) {
          console.log(`         ${s.order}. ${s.title} [${s.status}]`);
        }
      } else {
        console.log("      🗺️ Roadmap: YOK (henüz oluşturulmamış)");
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
