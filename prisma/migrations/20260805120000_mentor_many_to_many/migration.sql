-- #195: Öğrenci↔Mentör ilişkisini tek-mentor (StudentProfile.mentorId) yerine
-- M:N (MentorAssignment join tablosu) yap. Mevcut atamalar backfill ile taşınır.

-- CreateTable
CREATE TABLE "MentorAssignment" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorAssignment_mentorId_idx" ON "MentorAssignment"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorAssignment_studentProfileId_mentorId_key" ON "MentorAssignment"("studentProfileId", "mentorId");

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- #195 Backfill: eski StudentProfile.mentorId değerlerini join tablosuna kopyala.
INSERT INTO "MentorAssignment" ("id", "studentProfileId", "mentorId", "assignedAt")
SELECT gen_random_uuid()::text, "id", "mentorId", CURRENT_TIMESTAMP
FROM "StudentProfile"
WHERE "mentorId" IS NOT NULL;

-- DropForeignKey (eski tek-mentor FK)
ALTER TABLE "StudentProfile" DROP CONSTRAINT "StudentProfile_mentorId_fkey";

-- DropColumn (artık join tablosu tek doğruluk kaynağı)
ALTER TABLE "StudentProfile" DROP COLUMN "mentorId";
