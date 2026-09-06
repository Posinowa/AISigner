-- AlterTable
ALTER TABLE "ProjectTemplate" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "ProjectTemplate_createdById_idx" ON "ProjectTemplate"("createdById");

-- AddForeignKey
ALTER TABLE "ProjectTemplate" ADD CONSTRAINT "ProjectTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
