-- CreateTable
CREATE TABLE "MentorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "yearsExperience" INTEGER NOT NULL,
    "seniority" TEXT NOT NULL,
    "expertise" TEXT[],
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "weeklyHours" INTEGER NOT NULL,
    "motivation" VARCHAR(2000) NOT NULL,
    "mentoringStyle" VARCHAR(2000) NOT NULL,
    "githubUrl" TEXT,
    "linkedinUrl" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MentorProfile_userId_key" ON "MentorProfile"("userId");

-- AddForeignKey
ALTER TABLE "MentorProfile" ADD CONSTRAINT "MentorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
