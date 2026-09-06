import { describe, it, expect } from "vitest";
import { checkMigrationSql, ACK_MARKER } from "./check-migrations.mjs";

describe("check-migrations — migration güvenlik denetimi (#198 / #201)", () => {
  it("güvenli ve eklemeli SQL ifadelerinde ihlal bulmaz", () => {
    const safeSql = `
      -- Non-destructive migration
      ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'STUDENT';
      ALTER TABLE "Certificate" ALTER COLUMN "completionGrade" DROP DEFAULT;
      CREATE TABLE "NewTable" ("id" TEXT PRIMARY KEY);
      CREATE INDEX "idx_user_email" ON "User"("email");
    `;

    const violations = checkMigrationSql(safeSql, "2026_safe/migration.sql");
    expect(violations).toHaveLength(0);
  });

  it("onaysız DROP COLUMN tespit edildiğinde ihlal listeler", () => {
    const destructiveSql = `
      -- Dangerous migration
      ALTER TABLE "User" DROP COLUMN "oldColumn";
    `;

    const violations = checkMigrationSql(destructiveSql, "2026_bad/migration.sql");
    expect(violations).toHaveLength(1);
    expect(violations[0].label).toBe("DROP COLUMN");
    expect(violations[0].file).toBe("2026_bad/migration.sql");
    expect(violations[0].line).toBe(3);
  });

  it("onaysız DROP TABLE, RENAME ve SET NOT NULL ifadelerini tespit eder", () => {
    const multiDestructiveSql = `
      DROP TABLE "OldTable";
      ALTER TABLE "User" RENAME COLUMN "username" TO "handle";
      ALTER TABLE "User" RENAME TO "LegacyUser";
      ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
    `;

    const violations = checkMigrationSql(multiDestructiveSql, "2026_multi/migration.sql");
    expect(violations).toHaveLength(4);
    expect(violations.map((v: { label: string }) => v.label)).toEqual([
      "DROP TABLE",
      "RENAME COLUMN",
      "RENAME TO (tablo)",
      "SET NOT NULL",
    ]);
  });

  it("yorum satırındaki anahtar kelimeleri yanlış alarm olarak değerlendirmez", () => {
    const commentedSql = `
      -- DROP COLUMN is not executed here
      -- DROP TABLE was considered but not done
      SELECT 1;
    `;

    const violations = checkMigrationSql(commentedSql, "2026_commented/migration.sql");
    expect(violations).toHaveLength(0);
  });

  it(`${ACK_MARKER} onay etiketi varsa yıkıcı ifadeleri bilinçli kabul eder`, () => {
    const ackedSql = `
      -- ${ACK_MARKER} ilk-deploy: bos DB temizligi
      ALTER TABLE "User" DROP COLUMN "temporaryCol";
      DROP TABLE "TemporaryOldTable";
    `;

    const violations = checkMigrationSql(ackedSql, "2026_acked/migration.sql");
    expect(violations).toHaveLength(0);
  });
});
