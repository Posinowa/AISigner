-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "deliveryId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("deliveryId")
);

-- CreateIndex
CREATE INDEX "ProcessedWebhook_createdAt_idx" ON "ProcessedWebhook"("createdAt");
