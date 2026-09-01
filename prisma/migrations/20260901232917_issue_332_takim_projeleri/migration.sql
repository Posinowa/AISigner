-- DropForeignKey
ALTER TABLE "AssignedProject" DROP CONSTRAINT "AssignedProject_studentProfileId_fkey";

-- AlterTable
ALTER TABLE "AssignedProject" ADD COLUMN     "teamId" TEXT,
ALTER COLUMN "studentProfileId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RoadmapStep" ADD COLUMN     "assigneeId" TEXT;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMentor" (
    "teamId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,

    CONSTRAINT "TeamMentor_pkey" PRIMARY KEY ("teamId","mentorId")
);

-- CreateIndex
CREATE INDEX "TeamMember_studentProfileId_idx" ON "TeamMember"("studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_studentProfileId_key" ON "TeamMember"("teamId", "studentProfileId");

-- CreateIndex
CREATE INDEX "TeamMentor_mentorId_idx" ON "TeamMentor"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignedProject_teamId_projectTemplateId_key" ON "AssignedProject"("teamId", "projectTemplateId");

-- AddForeignKey
ALTER TABLE "AssignedProject" ADD CONSTRAINT "AssignedProject_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedProject" ADD CONSTRAINT "AssignedProject_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapStep" ADD CONSTRAINT "RoadmapStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMentor" ADD CONSTRAINT "TeamMentor_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMentor" ADD CONSTRAINT "TeamMentor_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- #332: SAHİP TAM BİRİ OLMALI — bireysel VEYA takım, ikisi birden ya da
-- hiçbiri değil. Prisma şemada ifade edemediği için ham CHECK.
--
-- Mevcut satırların hepsinde studentProfileId dolu, teamId NULL olduğu için
-- kısıt eklenirken hiçbiri ihlal etmiyor (expand-safe).
ALTER TABLE "AssignedProject"
  ADD CONSTRAINT "assigned_project_sahip_tek"
  CHECK (
    ("studentProfileId" IS NOT NULL AND "teamId" IS NULL)
    OR ("studentProfileId" IS NULL AND "teamId" IS NOT NULL)
  );
