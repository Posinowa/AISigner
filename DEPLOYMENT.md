# Dağıtım (Deployment) Notları

## Durum Yönetimi: Tek Instance vs Çok Instance

Bazı özellikler **proses-yerel (in-memory)** durum kullanır:

| Özellik | Dosya | Durum tipi |
|---|---|---|
| Rate limiting | `src/lib/rate-limit.ts` | `Map` (proses-yerel) |
| Şifre sıfırlama token'ları | `src/app/api/auth/forgot-password/verify/route.ts` | `Map` (proses-yerel) |
| Yüklenen dosyalar | `src/app/api/steps/[stepId]/files/route.ts` | Yerel disk (`process.cwd()/uploads`) |

### ✅ Tek instance (mevcut kurulum — Docker tek container)

Yukarıdakiler **olduğu gibi çalışır**. Tek dikkat edilmesi gereken:

- `uploads/` dizini **kalıcı bir volume** olmalı; aksi halde her yeniden deploy'da
  dosyalar silinir. `docker-compose.yml` içindeki `app` servisi bunu
  `uploads_data` named volume ile sağlar.

### ⚠️ Çok instance / Serverless (Vercel, birden fazla replica, autoscaling)

Proses-yerel durum **çalışmaz**:

- **Rate limiting**: Her instance ayrı sayar → limit etkisiz kalır.
- **Şifre sıfırlama token'ları**: Adım 2'de token'ı üreten instance ile Adım 3'e
  gelen istek farklı instance'a düşerse token bulunamaz → akış kopar.
- **Dosyalar**: Bir instance'a yüklenen dosya diğerinden okunamaz.

**Geçiş planı:**

1. **Redis** ekle (rate-limit + reset token):
   - `rate-limit.ts` içindeki `Map`'i Redis `INCR` + `EXPIRE` ile değiştir.
   - `resetTokens` Map'ini Redis `SETEX` (TTL'li) ile değiştir.
2. **Object storage** (GCS/S3) ekle (dosya yükleme):
   - `files/route.ts` ve `files/[fileId]/route.ts` içindeki `fs` çağrılarını
     imzalı URL veya stream tabanlı GCS/S3 erişimiyle değiştir.
   - `StepFile.storedName` zaten benzersiz; bucket key olarak kullanılabilir.

Bu değişiklikler izole edilebilir: çağrı yerleri (call site) zaten tek bir
yardımcı fonksiyona soyutlanabilecek şekilde dar tutulmuştur.

## Ortam Değişkenleri

Üretimde mutlaka tanımlı olmalı (`.env.example`'a bakın):

- `AUTH_SECRET` — güçlü rastgele değer (`openssl rand -base64 32`). Üretimde
  eksikse uygulama açılışta hata fırlatır.
- `DATABASE_URL` — Compose ağında host `db`, yerelde `localhost`.
- `GOOGLE_CLOUD_PROJECT` + `GOOGLE_APPLICATION_CREDENTIALS` — Vertex AI için
  GCP servis hesabı. `gcp-credentials.json` repoya **commit edilmez** (gitignore'da).

## Veritabanı Migrasyonları

`prisma/migrations/` klasörü mevcut (12 migration). Docker `CMD`
`prisma migrate deploy` çalıştırır → container başlangıcında şema otomatik
güncellenir, ekstra işlem gerekmez.

Yeni şema değişikliklerinde `npx prisma migrate dev --name <ad>` ile yeni bir
migration üretin. Üretimde yalnızca `prisma db push` kullanmak migration
geçmişini bozabilir; geçmişi tutarlı tutmak için migration akışını tercih edin.
