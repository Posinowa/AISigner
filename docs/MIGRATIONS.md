# Migration Güvenliği — expand/contract oyun kitabı

Bu belge, şema göçlerini (Prisma migration) **zero-downtime deploy'u bozmadan** yazmak
içindir. Kısa özet: **yıkıcı değişiklikleri (kolon/tablo silme, rename, NOT NULL) tek bir
deploy'da yapma — faz faz böl.**

> Deploy mekaniği için `DEPLOYMENT.md`. Guard: `npm run check:migrations` (CI'da zorunlu).

---

## 1. Neden sorun?

Out Plane (ve çoğu PaaS) **downtime'sız** deploy eder: yeni sürüm ayağa kalkarken **eski
sürüm hâlâ trafik alır**. Konteyner açılışında `docker-entrypoint.sh` → `prisma migrate
deploy` çalışır. Bu migration bir kolonu **drop** ederse, o kısa çakışma penceresinde hâlâ
koşan **eski kod** o kolonu sorgular → **hata**.

Yani şema ile kod **iki farklı sürümde** olabildiği an, şema **her iki koda da uyumlu**
olmalıdır.

---

## 2. Altın kural: expand → migrate → contract

Yıkıcı bir değişikliği **aynı** deploy'da yapma. Üç faza böl (genelde ≥2 ayrı deploy):

| Faz | Ne yapılır | Geriye uyumlu mu? |
|---|---|---|
| **1. Expand** | Yeni kolon/tablo **nullable/additive** eklenir. | ✅ Eski kod yeni alanı görmez, bozulmaz. |
| **2. Migrate** | Veri backfill edilir; kod **hem eskiyi hem yeniyi** yazar/okur (geçiş). | ✅ |
| **3. Contract** | Eski sürüm tamamen gidince, **AYRI bir deploy'da** eski kolon drop edilir. | ✅ Artık kimse kullanmıyor. |

### Örnekler

- **Kolon ekleme**: her zaman `NULL` veya `DEFAULT` ile ekle. `NOT NULL` gerekiyorsa: (1)
  nullable ekle, (2) backfill, (3) ayrı deploy'da `SET NOT NULL`.
- **Kolon silme**: (1) koddan kullanımını kaldır + deploy, (2) sonraki deploy'da `DROP COLUMN`.
- **Rename**: rename = drop + add. Yeni kolon ekle → çift-yaz → backfill → okumayı yeniye
  çevir → eskiyi ayrı deploy'da drop et.
- **Tabloyu M:N'e çevirme (gerçek örnek #195)**: `StudentProfile.mentorId` → `MentorAssignment`
  join tablosu. Güvenli sıra: (1) join tablosunu ekle + çift-yaz, (2) backfill, (3) ayrı
  deploy'da `mentorId` kolonunu drop et. *(#195 tek migration'da drop etti; ilk deploy boş
  DB'ye gittiği için sorun olmadı — aşağıya bak.)*

---

## 3. İstisna: ilk deploy / boş DB

İlk deploy'da **eski sürüm yoktur** — tüm migration'lar temiz/boş bir DB'ye uygulanır,
çakışma penceresi yoktur. Bu yüzden **ilk deploy öncesi** yazılmış migration'lar drop içerse
de güvenlidir. Kural asıl **canlıya çıktıktan sonraki** güncellemeler için geçerlidir.

---

## 4. Guard: `npm run check:migrations`

`scripts/check-migrations.mjs`, `prisma/migrations/*/migration.sql` içinde **DROP COLUMN,
DROP TABLE, RENAME, SET NOT NULL** arar. Böyle bir ifade bulur ve migration **onay yorumu
taşımıyorsa CI FAIL** eder. (CI adımı: `.github/workflows/ci.yml`.)

Bilinçli ve güvenli olduğundan eminsen (ör. ilk-deploy boş DB, ya da expand/contract'ın 3.
fazı — kimse artık kullanmıyor), migration dosyasının başına şunu ekle:

```sql
-- migration-safety-ack: expand/contract faz-3; kolon 2 deploy önce kod tarafında bırakıldı
```

Onay yorumu **düşünmeyi zorunlu kılar** — drop'un kazara canlıya gitmesini engeller.

---

## 5. Çok-instance notu

`prisma migrate deploy` bir **Postgres advisory lock** alır → aynı anda birden çok konteyner
`migrate deploy` çalıştırsa bile yalnızca biri uygular, diğerleri bekler/atlar (veri
bozulmaz). Yani entrypoint'te migration çalıştırmak tek-instance'ta olduğu gibi çok-instance'ta
da **güvenlidir**. Yine de büyük/uzun migration'larda tercih: migration'ı ayrı bir
**release/pre-deploy adımına** taşımak (Out Plane böyle bir hook sunuyorsa).

---

## 6. PR checklist (migration içeren PR'lar)

- [ ] Migration **additive** mi? (yeni alan nullable/default ile mi?)
- [ ] Drop/rename/NOT NULL var mı? Varsa **expand/contract'a** bölündü mü?
- [ ] `npm run check:migrations` yeşil mi? (yıkıcı + onaysız ifade yok)
- [ ] Backfill gerekiyorsa migration'a eklendi mi (veri kaybı yok)?
- [ ] İlk-deploy istisnası geçerliyse `-- migration-safety-ack:` gerekçesi yazıldı mı?
