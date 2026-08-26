-- migration-safety-ack: #264 expand/contract 3. faz. Guvenlik sorulari #262'de
-- sifirlama yolundan cikarildi, #278'de kod tamamen kaldirildi. Tabloyu okuyan
-- veya yazan hicbir kod kalmadi; eski surum bu tabloyu sorgulamiyor, dolayisiyla
-- downtime'siz deployda birlikte kosan surumler icin risk yok.
-- Uretimde kayit sayisi 0 olarak dogrulandi (sahibi tarafindan).

/*
  Warnings:

  - You are about to drop the `SecurityAnswer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SecurityAnswer" DROP CONSTRAINT "SecurityAnswer_userId_fkey";

-- DropTable
DROP TABLE "SecurityAnswer";
