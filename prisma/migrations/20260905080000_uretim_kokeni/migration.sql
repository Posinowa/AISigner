-- #494: AI çıktısının üretim kökeni (prompt sürümü + model).
--
-- ⚠️ ADDITIVE ve NULLABLE (docs/MIGRATIONS.md §2 expand aşaması):
-- eski kod bu alanları görmez ve bozulmaz, geri alma kod sürümünü
-- döndürmekle yeterlidir.
--
-- ⚠️ BACKFILL YOK ve bilerek: alanlar eklenmeden ÖNCE üretilmiş kayıtların
-- kökeni gerçekten BİLİNMİYOR. Uydurma bir sürüm yazmak, güncel olabilecek
-- analizleri "eski" gösterip gereksiz (ücretli) yeniden üretime yol açardı.
ALTER TABLE "ProfileAnalysis" ADD COLUMN "uretimSurumu" TEXT;
ALTER TABLE "ProfileAnalysis" ADD COLUMN "uretimModeli" TEXT;

ALTER TABLE "MentorAnalysis" ADD COLUMN "uretimSurumu" TEXT;
ALTER TABLE "MentorAnalysis" ADD COLUMN "uretimModeli" TEXT;
