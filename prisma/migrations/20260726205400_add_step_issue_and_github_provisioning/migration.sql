-- AlterTable
ALTER TABLE "AssignedProject" ADD COLUMN     "githubRepoUrl" TEXT,
ADD COLUMN     "githubStatus" TEXT NOT NULL DEFAULT 'NOT_PROVISIONED',
ADD COLUMN     "provisionedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StepIssue" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "bodyMarkdown" VARCHAR(4000) NOT NULL,
    "githubIssueUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StepIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StepIssue_stepId_idx" ON "StepIssue"("stepId");

-- AddForeignKey
ALTER TABLE "StepIssue" ADD CONSTRAINT "StepIssue_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "RoadmapStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
