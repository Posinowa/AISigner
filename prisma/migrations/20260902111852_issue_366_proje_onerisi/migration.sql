-- AlterTable
ALTER TABLE "ProjectTemplate" ADD COLUMN     "fromProposal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProjectProposal" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "goals" VARCHAR(2000) NOT NULL,
    "technologies" TEXT[],
    "kaynak" TEXT NOT NULL DEFAULT 'BIZIM',
    "repoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" VARCHAR(500),
    "kararKaynak" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedProjectId" TEXT,
    "pendingKey" TEXT,

    CONSTRAINT "ProjectProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProposal_assignedProjectId_key" ON "ProjectProposal"("assignedProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProposal_pendingKey_key" ON "ProjectProposal"("pendingKey");

-- CreateIndex
CREATE INDEX "ProjectProposal_status_createdAt_idx" ON "ProjectProposal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectProposal_studentProfileId_idx" ON "ProjectProposal"("studentProfileId");

-- AddForeignKey
ALTER TABLE "ProjectProposal" ADD CONSTRAINT "ProjectProposal_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProposal" ADD CONSTRAINT "ProjectProposal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

