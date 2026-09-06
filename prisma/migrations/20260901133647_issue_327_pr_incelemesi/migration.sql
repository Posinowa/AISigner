-- CreateTable
CREATE TABLE "PullRequestReview" (
    "id" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PullRequestReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestReview_repoUrl_prNumber_key" ON "PullRequestReview"("repoUrl", "prNumber");
