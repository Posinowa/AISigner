-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('SUGGESTION', 'REQUEST');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "SuggestionType" NOT NULL DEFAULT 'SUGGESTION',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_authorId_createdAt_idx" ON "Suggestion"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_status_createdAt_idx" ON "Suggestion"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
