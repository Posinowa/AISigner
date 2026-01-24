-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."AssignedProject" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "projectTemplateId" TEXT NOT NULL,
    "status" "public"."AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignedProject_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."AssignedProject" ADD CONSTRAINT "AssignedProject_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "public"."StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignedProject" ADD CONSTRAINT "AssignedProject_projectTemplateId_fkey" FOREIGN KEY ("projectTemplateId") REFERENCES "public"."ProjectTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
