-- CreateTable
CREATE TABLE "public"."SecurityAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityAnswer_userId_idx" ON "public"."SecurityAnswer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAnswer_userId_questionId_key" ON "public"."SecurityAnswer"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "public"."SecurityAnswer" ADD CONSTRAINT "SecurityAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
