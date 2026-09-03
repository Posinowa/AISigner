-- Ayni mentor ayni ana IKI slot acamaz (#398).
--
-- Canli testte bulundu: "Aralik ac" iki kez tiklandiginda takvim ikizleniyor
-- ve stajyer ayni 14:00 dilimini iki kez goruyordu. Kural veritabaninda;
-- cagiran taraf skipDuplicates ile yeniden acmayi idempotent yapiyor.
CREATE UNIQUE INDEX "OfisSaatiSlotu_mentorId_baslangic_key" ON "OfisSaatiSlotu"("mentorId", "baslangic");
