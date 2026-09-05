-- #503: Tekrarlanabilir proje şablonları.
--
-- Bazı işler doğası gereği tekrarlanır (herkesin yapması beklenen portfolyo
-- sitesi, birden çok kez verilebilen araştırma ödevleri). Bugüne kadar
-- @@unique([studentProfileId, projectTemplateId]) — #58'in yarış koruması —
-- bunu imkânsız kılıyordu.
--
-- ⚠️ KISMİ BENZERSİZ İNDEKS PRISMA'DA İFADE EDİLEMİYOR. Bu yüzden deponun
-- koşullu tekillik için zaten kullandığı desen uygulanıyor (`pendingKey` —
-- #345/#349/#366): Postgres çoklu NULL'a izin verdiğinden, `tekilKey` dolu
-- olan satırlar tekil kalır, NULL olanlar serbesttir.
--
-- ⚠️ SIRALAMA ÖNEMLİ: önce kolonlar, sonra BACKFILL, sonra yeni indeks,
-- en son eski indekslerin düşürülmesi. Backfill indeksten ÖNCE yapılıyor ki
-- beklenmedik bir çakışma sessizce geçmesin, migration'da patlasın.

-- 1) Yeni kolonlar
ALTER TABLE "ProjectTemplate" ADD COLUMN "tekrarlanabilir" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssignedProject" ADD COLUMN "tekilKey" TEXT;

-- 2) BACKFILL — mevcut atamaların #58 koruması KAYBOLMAMALI.
--    Bu noktada her şablon `tekrarlanabilir = false` (yeni kolonun varsayılanı),
--    yani var olan her satır anahtar alıyor ve tekillik aynen sürüyor.
UPDATE "AssignedProject"
SET "tekilKey" = 'sp:' || "studentProfileId" || ':' || "projectTemplateId"
WHERE "studentProfileId" IS NOT NULL;

UPDATE "AssignedProject"
SET "tekilKey" = 'tm:' || "teamId" || ':' || "projectTemplateId"
WHERE "teamId" IS NOT NULL;

-- 3) Yeni koşullu tekillik
CREATE UNIQUE INDEX "AssignedProject_tekilKey_key" ON "AssignedProject"("tekilKey");

-- 4) Eski sabit kısıtlar kalkıyor.
--    ⚠️ Bu adım eski kodu KIRMAZ: bir kısıtı gevşetmek geriye uyumludur —
--    eski sürüm bu indeksleri okumuyor, yalnız ihlal ettiğinde P2002 alıyordu.
--    `check-migrations.mjs` DROP CONSTRAINT/INDEX'i bu sebeple yıkıcı saymıyor.
DROP INDEX "AssignedProject_studentProfileId_projectTemplateId_key";
DROP INDEX "AssignedProject_teamId_projectTemplateId_key";
