-- AlterEnum
ALTER TYPE "StepStatus" ADD VALUE 'REVISION_REQUESTED';

-- AlterTable
ALTER TABLE "StepStatusHistory" ADD COLUMN     "note" VARCHAR(1000);

