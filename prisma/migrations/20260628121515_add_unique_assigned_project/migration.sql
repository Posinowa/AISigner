-- CreateIndex
CREATE UNIQUE INDEX "AssignedProject_studentProfileId_projectTemplateId_key" ON "AssignedProject"("studentProfileId", "projectTemplateId");
