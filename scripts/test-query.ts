import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = "cmluxs0cj0002q4igkmtxk5ir"; // student@example.com
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      assignedProjects: {
        include: {
          projectTemplate: true,
          roadmap: {
            include: {
              steps: { orderBy: { order: "asc" } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  console.log("Profile found:", !!profile);
  console.log("Projects count:", profile?.assignedProjects.length);

  if (profile?.assignedProjects[0]) {
    const p = profile.assignedProjects[0];
    console.log("Project:", p.projectTemplate.title);
    console.log("Has Roadmap:", !!p.roadmap);
    console.log("Steps count:", p.roadmap?.steps.length);
    console.log("Steps:", p.roadmap?.steps.map((s) => `${s.order}. ${s.title} [${s.status}]`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
