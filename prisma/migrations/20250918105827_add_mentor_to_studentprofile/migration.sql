-- AlterTable
ALTER TABLE "public"."StudentProfile" ADD COLUMN     "mentorId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."StudentProfile" ADD CONSTRAINT "StudentProfile_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
