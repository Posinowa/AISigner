/**
 * AI özellik (feature) testi — gerçek prompt + JSON ayrıştırma yollarını çalıştırır.
 * DB gerekmez; sahte profil/şablon nesneleri kullanılır.
 * Çalıştır: npm run test:ai:features
 */
import { analyzeStudentProfile } from "../src/features/ai/server/profile-analysis";
import { recommendProjects } from "../src/features/ai/server/project-recommendations";
import { generateRoadmap } from "../src/features/ai/server/generate-roadmap";
import type { StudentProfile, ProjectTemplate } from "@prisma/client";

const profile = {
  id: "sp1",
  userId: "u1",
  experienceLevel: "intermediate",
  interests: ["Web Development", "AI"],
  goals: "Kendi yapay zeka destekli web uygulamamı geliştirmek istiyorum.",
  availability: "part-time",
  birthYear: 2002,
  mentorId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as StudentProfile;

const templates = [
  { id: "t1", title: "To-Do List API", description: "REST API ile görev yönetimi", track: ["Backend", "Node.js"], difficulty: "EASY" },
  { id: "t2", title: "AI Chatbot Web App", description: "LLM tabanlı sohbet uygulaması", track: ["Web Development", "AI"], difficulty: "MEDIUM" },
  { id: "t3", title: "Dağıtık Mesaj Kuyruğu", description: "Ölçeklenebilir mesaj sistemi", track: ["Backend", "Distributed Systems"], difficulty: "HARD" },
] as unknown as ProjectTemplate[];

async function main() {
  console.log("=== 1) Profil Analizi (analyzeStudentProfile) ===");
  const analysis = await analyzeStudentProfile({
    experienceLevel: profile.experienceLevel,
    interests: profile.interests,
    goals: profile.goals ?? undefined,
    availability: profile.availability ?? undefined,
  });
  console.log("  level   :", analysis.level);
  console.log("  tracks  :", analysis.tracks.join(", "));
  console.log("  summary :", analysis.summary.slice(0, 90));
  console.log("  öneri   :", analysis.recommendations.length, "adet");

  console.log("\n=== 2) Proje Önerisi (recommendProjects) ===");
  const recs = await recommendProjects(profile, templates);
  recs.forEach((r) => console.log(`  -> ${r.projectId}  %${r.matchScore}  ${r.reason.slice(0, 55)}`));

  console.log("\n=== 3) Roadmap Üretimi (generateRoadmap) ===");
  const steps = await generateRoadmap(profile, templates[1]);
  console.log(`  ${steps.length} adım üretildi:`);
  steps.forEach((s) => console.log(`  ${s.order}. ${s.title} (${s.estimatedHours}s, ${s.resources.length} kaynak)`));

  console.log("\n✅ TÜM AI ÖZELLİKLERİ ÇALIŞIYOR");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n❌ HATA:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
