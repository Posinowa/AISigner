-- CreateTable
CREATE TABLE "ProfileAnalysis" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "strengths" TEXT[],
    "developmentAreas" TEXT[],
    "technicalTracks" TEXT[],
    "recommendedPath" VARCHAR(2000) NOT NULL,
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileAnalysis_studentProfileId_key" ON "ProfileAnalysis"("studentProfileId");

-- AddForeignKey
ALTER TABLE "ProfileAnalysis" ADD CONSTRAINT "ProfileAnalysis_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
