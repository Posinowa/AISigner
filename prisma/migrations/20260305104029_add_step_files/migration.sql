-- CreateTable
CREATE TABLE "public"."StepFile" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StepFile_storedName_key" ON "public"."StepFile"("storedName");

-- CreateIndex
CREATE INDEX "StepFile_stepId_idx" ON "public"."StepFile"("stepId");

-- CreateIndex
CREATE INDEX "StepFile_uploaderId_idx" ON "public"."StepFile"("uploaderId");

-- AddForeignKey
ALTER TABLE "public"."StepFile" ADD CONSTRAINT "StepFile_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "public"."RoadmapStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StepFile" ADD CONSTRAINT "StepFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
