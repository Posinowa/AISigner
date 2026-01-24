-- CreateEnum
CREATE TYPE "public"."Difficulty" AS ENUM ('HARD', 'MEDIUM', 'EASY');

-- CreateTable
CREATE TABLE "public"."ProjectTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "track" TEXT[],
    "difficulty" "public"."Difficulty" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);
