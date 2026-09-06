-- CreateTable
CREATE TABLE "TypingSignal" (
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TypingSignal_pkey" PRIMARY KEY ("fromUserId","toUserId")
);

-- CreateIndex
CREATE INDEX "TypingSignal_toUserId_expiresAt_idx" ON "TypingSignal"("toUserId", "expiresAt");

-- AddForeignKey
ALTER TABLE "TypingSignal" ADD CONSTRAINT "TypingSignal_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypingSignal" ADD CONSTRAINT "TypingSignal_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

