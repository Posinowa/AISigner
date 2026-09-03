-- AlterTable
ALTER TABLE "MentorProfile" ADD COLUMN     "gorusmeLinki" VARCHAR(500);

-- CreateTable
CREATE TABLE "OfisSaatiSlotu" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "baslangic" TIMESTAMP(3) NOT NULL,
    "bitis" TIMESTAMP(3) NOT NULL,
    "rezerveEdenId" TEXT,
    "rezerveEdildiAt" TIMESTAMP(3),
    "ogrenciNotu" VARCHAR(500),
    "mentorNotu" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfisSaatiSlotu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfisSaatiSlotu_mentorId_baslangic_idx" ON "OfisSaatiSlotu"("mentorId", "baslangic");

-- CreateIndex
CREATE INDEX "OfisSaatiSlotu_rezerveEdenId_baslangic_idx" ON "OfisSaatiSlotu"("rezerveEdenId", "baslangic");

-- AddForeignKey
ALTER TABLE "OfisSaatiSlotu" ADD CONSTRAINT "OfisSaatiSlotu_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfisSaatiSlotu" ADD CONSTRAINT "OfisSaatiSlotu_rezerveEdenId_fkey" FOREIGN KEY ("rezerveEdenId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

