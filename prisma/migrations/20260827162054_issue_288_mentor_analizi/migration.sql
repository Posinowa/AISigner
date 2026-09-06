-- CreateTable
CREATE TABLE "MentorAnalysis" (
    "id" TEXT NOT NULL,
    "mentorProfileId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "strengths" TEXT[],
    "technicalTracks" TEXT[],
    "idealStudentProfile" VARCHAR(2000) NOT NULL,
    "matchingNotes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MentorAnalysis_mentorProfileId_key" ON "MentorAnalysis"("mentorProfileId");

-- AddForeignKey
ALTER TABLE "MentorAnalysis" ADD CONSTRAINT "MentorAnalysis_mentorProfileId_fkey" FOREIGN KEY ("mentorProfileId") REFERENCES "MentorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
