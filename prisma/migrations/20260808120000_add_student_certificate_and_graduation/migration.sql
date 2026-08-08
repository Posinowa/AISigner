-- #204: Staj mezuniyeti + başarı sertifikası. Additive (nullable kolonlar + enum değeri).
-- M:N migration'ının (20260805120000) ÜSTÜNE gelir; mentorId/MentorAssignment'a dokunmaz.

-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'GRADUATED';

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "certificateNumber" TEXT,
ADD COLUMN     "completionGrade" TEXT DEFAULT 'Üstün Başarı',
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "mentorNote" VARCHAR(2000);
