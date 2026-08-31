-- CreateTable
CREATE TABLE "StepStatusHistory" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StepStatusHistory_stepId_createdAt_idx" ON "StepStatusHistory"("stepId", "createdAt");

-- CreateIndex
CREATE INDEX "StepStatusHistory_toStatus_createdAt_idx" ON "StepStatusHistory"("toStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "StepStatusHistory" ADD CONSTRAINT "StepStatusHistory_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "RoadmapStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepStatusHistory" ADD CONSTRAINT "StepStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
