#!/usr/bin/env node
// #198: Yıkıcı migration guard — zero-downtime deploy güvenliği.
//
// prisma/migrations/*/migration.sql içindeki geriye-uyumsuz (yıkıcı) ifadeleri
// yakalar: DROP COLUMN, DROP TABLE, RENAME COLUMN/TABLE, SET NOT NULL. Böyle bir
// ifade içeren bir migration açık onay yorumu taşımıyorsa CI'ı FAIL eder.
//
// Neden: Out Plane downtime'sız deploy'da eski + yeni sürüm kısa süre birlikte koşar.
// Yeni konteynerdeki `migrate deploy` bir kolonu drop ederse, hâlâ trafik alan eski
// sürüm o kolonu sorgulayınca hata verir. Çözüm expand/contract'tır (docs/MIGRATIONS.md).
//
// Bilinçli/güvenli bir drop (ör. ilk deploy — boş DB, ya da expand/contract'ın 3.
// fazı) için migration dosyasının başına şu yorumu ekleyin:
//   -- migration-safety-ack: <kısa gerekçe>
//
// Bağımlılık yok — CI'da `npm ci` öncesinde bile çalışır.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");
const ACK_MARKER = "migration-safety-ack:";

// Geriye-uyumsuz ifadeler. DROP CONSTRAINT bilinçli olarak DIŞARIDA: init pkey
// churn'ü gibi benign durumlarda yanlış alarm yapmasın.
const DESTRUCTIVE = [
  { re: /\bDROP\s+COLUMN\b/i, label: "DROP COLUMN" },
  { re: /\bDROP\s+TABLE\b/i, label: "DROP TABLE" },
  { re: /\bRENAME\s+COLUMN\b/i, label: "RENAME COLUMN" },
  { re: /\bRENAME\s+TO\b/i, label: "RENAME TO (tablo)" },
  { re: /\bSET\s+NOT\s+NULL\b/i, label: "SET NOT NULL" },
];

if (!existsSync(MIGRATIONS_DIR)) {
  console.log("Migration klasörü yok — atlanıyor.");
  process.exit(0);
}

const violations = [];
for (const entry of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const sqlPath = path.join(MIGRATIONS_DIR, entry.name, "migration.sql");
  if (!existsSync(sqlPath)) continue;

  const sql = readFileSync(sqlPath, "utf8");
  const acked = sql.includes(ACK_MARKER);
  if (acked) continue; // Bilinçli onaylanmış — atla.

  sql.split(/\r?\n/).forEach((line, i) => {
    if (line.trim().startsWith("--")) return; // yorum satırı
    for (const d of DESTRUCTIVE) {
      if (d.re.test(line)) {
        violations.push({
          file: `${entry.name}/migration.sql`,
          line: i + 1,
          label: d.label,
          text: line.trim(),
        });
      }
    }
  });
}

if (violations.length === 0) {
  console.log("✓ Migration güvenlik kontrolü: yıkıcı + onaysız ifade yok.");
  process.exit(0);
}

console.error("✗ Yıkıcı (geriye-uyumsuz) migration ifadeleri bulundu — onay yorumu yok:\n");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.label}]  ${v.text}`);
}
console.error(`
Zero-downtime deploy'da eski sürüm hâlâ koşarken bu ifadeler onu bozabilir.
Çözüm (bkz. docs/MIGRATIONS.md): expand/contract — önce additive ekle, sonra AYRI
bir deploy'da drop et. Bilinçli ve güvenli olduğundan eminsen migration dosyasının
başına şu yorumu ekle:

  -- migration-safety-ack: <kısa gerekçe (ör. ilk-deploy: boş DB / expand-contract faz-3)>
`);
process.exit(1);
