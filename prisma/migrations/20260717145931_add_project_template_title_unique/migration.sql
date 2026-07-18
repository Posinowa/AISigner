-- #112: ProjectTemplate.title unique constraint.
-- Önce olası duplicate title'lar veri kaybı OLMADAN benzersizleştirilir:
-- aynı title'a sahip daha yeni kayıtların sonuna kendi id'leri eklenir.
-- (Silme yapılmaz: AssignedProject FK'ları RESTRICT olduğundan silme zaten riskli olurdu.)
UPDATE "ProjectTemplate" t
SET "title" = t."title" || ' (' || t."id" || ')'
WHERE EXISTS (
  SELECT 1 FROM "ProjectTemplate" t2
  WHERE t2."title" = t."title"
    AND (t2."createdAt" < t."createdAt" OR (t2."createdAt" = t."createdAt" AND t2."id" < t."id"))
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTemplate_title_key" ON "ProjectTemplate"("title");
