-- CreateTable
CREATE TABLE "WorkspaceRequest" (
    "id" TEXT NOT NULL,
    "assignedProjectId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mentorNote" VARCHAR(500),
    "adminNote" VARCHAR(500),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingKey" TEXT,

    CONSTRAINT "WorkspaceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceRequest_pendingKey_key" ON "WorkspaceRequest"("pendingKey");

-- CreateIndex
CREATE INDEX "WorkspaceRequest_status_createdAt_idx" ON "WorkspaceRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceRequest_assignedProjectId_idx" ON "WorkspaceRequest"("assignedProjectId");

-- AddForeignKey
ALTER TABLE "WorkspaceRequest" ADD CONSTRAINT "WorkspaceRequest_assignedProjectId_fkey" FOREIGN KEY ("assignedProjectId") REFERENCES "AssignedProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceRequest" ADD CONSTRAINT "WorkspaceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceRequest" ADD CONSTRAINT "WorkspaceRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
