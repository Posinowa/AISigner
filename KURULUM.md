# Kurulum — Detaylı Sorun Giderme

> Bu dosya, ana kurulum adımları için **değil**, yerel veritabanı kurulumunda karşılaşılabilecek
> sorunları gidermek için bir referanstır. Adım adım kurulum için `README.md`'deki **"Hızlı
> Kurulum"** bölümünü kullanın. Modellerin güncel/otoriter tanımı için `prisma/schema.prisma`
> dosyasına bakın — bu dosyanın burada ayrı bir kopyası tutulmuyor (kopyalar kodla çelişip eskir).

## 1. PostgreSQL (Docker)

```bash
docker compose up -d
docker compose ps   # Servisin "Up" olduğunu doğrula
```

Beklenen çıktıda `aisigner_db` servisi `Up` durumda ve `0.0.0.0:5432->5432/tcp` portu açık olmalı.

## 2. Migration ve Prisma Client

Bu repo migration geçmişini (`prisma/migrations/`) commit'lenmiş halde içerir. Fresh bir clone'da
bunları **uygulamak** için (yeni migration oluşturmak için değil):

```bash
npx prisma migrate deploy
npx prisma generate
```

`npx prisma migrate dev` yalnızca `schema.prisma`'da **yeni bir değişiklik** yapıp yeni bir
migration üretirken kullanılır — aktif geliştirme sırasında.

**Tablolar doğru oluştu mu?**
```bash
docker exec -it aisigner_db bash -c "psql -U postgres -d aisigner -c '\dt'"
```

**Prisma Studio ile görsel kontrol** (`http://localhost:5555`):
```bash
npx prisma studio
```

## 3. Test Verisi

```bash
npm run seed
```

Ne oluşturduğu ve idempotency davranışı için `README.md`'deki **"Seed Nasıl Çalıştırılır?"**
bölümüne bakın. Elle `INSERT` ile düz metin şifre eklemeyin — seed script argon2 ile hash'ler.

## 4. Eğer Hata Alırsan

1. Docker container'ının çalıştığından emin ol: `docker ps`
2. `.env` dosyasındaki `DATABASE_URL`'i kontrol et (bkz. `.env.example`)
3. Migration/schema uyumsuzluğu varsa (yalnızca lokal/geliştirme ortamında — **veri kaybına yol
   açar**): `npx prisma migrate reset`
4. `AUTH_SECRET` ortam değişkeninin tanımlı olduğundan emin ol (NextAuth v4 bunu bekler —
   `NEXTAUTH_SECRET` değil).
