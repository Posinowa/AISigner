-- AlterTable
ALTER TABLE "AssignedProject" ADD COLUMN     "sonCommitAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "refId" VARCHAR(64);

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "takilmaBildirimi" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Notification_userId_type_refId_idx" ON "Notification"("userId", "type", "refId");

