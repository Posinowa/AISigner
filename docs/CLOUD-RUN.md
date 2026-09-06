# Google Cloud (Cloud Run) dağıtımı — #522

Bu belge AISigner'ı **Cloud Run** üzerinde çalıştırmak için gereken adımları ve
**ölçülmüş tuzakları** anlatır. Genel dağıtım sözleşmesi `DEPLOYMENT.md`'de;
burada yalnızca Google Cloud'a özgü olanlar var.

> ⚠️ **"Ücretsiz katman" değil, 90 günlük kredi.** Google Cloud'un tanıtım
> kredisi hem süreli hem tutarlıdır. Cloud SQL kalıcı bir maliyet kalemidir ve
> aşağıdaki "her zaman açık" önerileri (`--no-cpu-throttling`,
> `--min-instances=1`) bu krediden yer. Kredi bittiğinde servis **durur**;
> bitiş tarihi takvime konmalı.

---

## 1. Mimari

| Bileşen | Hizmet |
|---|---|
| Uygulama | **Cloud Run** (`Dockerfile`, standalone çıktı) |
| İmaj deposu | **Artifact Registry** |
| Veritabanı | **Cloud SQL for PostgreSQL** |
| Sırlar | **Secret Manager** |
| Dosya yüklemeleri | **Cloud Storage** (`GCS_BUCKET`, #197) |
| Yapay zekâ | **Vertex AI** (zaten kullanılıyor) |

---

## 2. ⚠️ Kimlik: anahtar dosyası KULLANMAYIN

Cloud Run'da kimlik, servisin **kendi service account'undan** ADC ile gelir.
`GCP_CREDENTIALS_JSON` **verilmemelidir**: saklanacak, dağıtılacak ve
döndürülecek uzun ömürlü bir sır olmaz.

⚠️ **Bu, #522'de düzeltilen bir engeldi.** `gemini-client.ts` daha önce her
koşulda bir anahtar DOSYASI istiyordu; dosya yokken istemci kurulumu patlıyor
ve çağıran taraf #335'in graceful degradation'ı gereği **mock'a düşüyordu** —
yani IAM doğru ayarlanmış olsa bile AI **sessizce sahte içerik** üretirdi.
Artık dosya yoksa `googleAuthOptions` hiç verilmiyor ve SDK ADC'yi çözüyor.
(GCS tarafı zaten böyle çalışıyordu; tutarsızlık kendini ele veriyordu.)

Servis hesabına verilecek roller:

```bash
gcloud projects add-iam-policy-binding "$PROJE" \
  --member="serviceAccount:$SA" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding "$PROJE" \
  --member="serviceAccount:$SA" --role="roles/cloudsql.client"
gcloud projects add-iam-policy-binding "$PROJE" \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"
```

---

## 3. ⚠️ CPU tahsisi: `--no-cpu-throttling`

Cloud Run'ın varsayılanı **"CPU yalnızca istek sırasında"**. Uygulama yanıt
DÖNDÜKTEN SONRA iş yapan birkaç yol içeriyor ve bunlar varsayılan ayarla
askıya alınır ya da hiç bitmez:

- `after()` ile arka planda koşan işler: çalışma alanı kurulumu
  (`provisioning.ts`), revizyonun GitHub'a yansıtılması (#378/#379), rıza
  değişiminin türev veriye etkisi (#352), hata bildirimi (#316/#519).
- Sayaç yayını (#490) — 5 dakikalık zamanlayıcı.
- Gerçek zamanlı akışın tiki (#329) ve ona bağlı takılma radarı (#397).

---

## 4. ⚠️ `--min-instances=1` — yoksa özellikler SESSİZCE durur

Sıfıra inen bir serviste yalnız "soğuk başlangıç" olmaz; **süreç düzeyinde
yaşayan işler tamamen durur**:

- **#329 canlı akış (SSE):** bağlantı kesilir. Özellik ölmez — istemci
  tasarım gereği yoklamaya düşer — ama gecikme büyür.
- **#397 takılma radarı:** taraması #329'un tikinden besleniyor. "Kimse bağlı
  değilken çalışmaz" zaten bilinen bir sınırdı; sıfıra inen serviste bu sınır
  genişler.
- **#490 sayaç yayını:** yayınlanmayan sayaç, olmayan sayaçtır.

---

## 5. ⚠️ `HOSTNAME` env'ini TANIMLAMAYIN — ölçüldü

`Dockerfile` `ENV HOSTNAME=0.0.0.0` veriyor ve standalone sunucu istek URL'ini
**`Host` başlığından değil** `HOSTNAME`/`PORT` env'inden kuruyor
(`trustHostHeader: false`).

Gerçek imajla ölçüldü:

| Durum | Sonuç |
|---|---|
| Düz `docker run` | `HOSTNAME=0.0.0.0` — imajın `ENV`'i, çalışma zamanının enjekte ettiği konteyner kimliğini **eziyor** |
| `-e PORT=8080` (Cloud Run gibi) | `HOSTNAME=0.0.0.0`, `PORT=8080` — sorun yok |
| `-e HOSTNAME=<başka değer>` | Açık env **kazanır** — bozulur |

Kapıyı tutan tek şey `ENV HOSTNAME=0.0.0.0` satırıdır. Cloud Run
yapılandırmasına elle bir `HOSTNAME` değişkeni eklemek onu bozar:
yönlendirmeler mutlak ve **yanlış origin**'e çıkar, oturum çerezi düşer,
kullanıcı sonsuz `/signin` döngüsünde kalır.

Aynı imaj Cloud Run gibi çalıştırılıp doğrulandı: `/api/health` → `ok` +
`db: connected`; oturumsuz `/student-dashboard` → **göreli** `location:
/signin?...`; oturumsuz `/api/student/proposals` → **401 JSON** (#375).

---

## 6. Cloud SQL bağlantısı

Cloud Run, Cloud SQL'e **unix soket** üzerinden bağlanır. Prisma için
`DATABASE_URL`:

```
postgresql://USER:PASS@localhost/aisigner?host=/cloudsql/PROJE:BOLGE:ORNEK&schema=public
```

Servise eklenecek bağlantı: `--add-cloudsql-instances "$PROJE:$BOLGE:$ORNEK"`

⚠️ **Migration'lar her konteyner başlangıcında koşar** (`docker-entrypoint.sh`
→ `prisma migrate deploy`). Prisma advisory lock kullandığı için eşzamanlı
başlayan konteynerlerde güvenlidir, ama başlangıç süresine eklenir. Yıkıcı
migration kuralı değişmedi: `docs/MIGRATIONS.md`.

---

## 7. ⚠️ `NEXT_PUBLIC_APP_URL` derleme anında gömülür

Değer client bundle'a **build sırasında** yazılır. Cloud Run'a çalışma zamanı
değişkeni olarak eklemek **hiçbir şey yapmaz** — #400'de Docker imajını kıran
sebep buydu ve CI'daki `docker image` işi tam da bunu kanıtlamak için var.

```bash
docker build --build-arg NEXT_PUBLIC_APP_URL="https://<alan-adiniz>" \
             --build-arg APP_VERSION="$(git rev-parse --short HEAD)" -t "$IMAJ" .
```

---

## 8. ⚠️ `TRUSTED_PROXY_HOPS` ÖLÇÜLMELİ — buraya bir sayı yazılmadı

`lib/client-ip.ts` istemci IP'sini `X-Forwarded-For`'un **sağından**
`TRUSTED_PROXY_HOPS` kadar sayarak bulur (#308). Yanlış değer rate-limit'i
atlatılabilir yapar.

Cloud Run'ın önüne bir yük dengeleyici ya da CDN konulursa hop sayısı değişir;
bu yüzden buraya **varsayılan bir sayı yazılmadı**. İlk dağıtımdan sonra
`DEPLOYMENT.md §7`'deki iki adımlı vekil doğrulaması çalıştırılıp değer ona
göre ayarlanmalı.

---

## 9. Sırlar

`AUTH_SECRET`, veritabanı parolası, `GITHUB_TOKEN`, `SMTP_*` ve `SENTRY_DSN`
(#519) Secret Manager'da tutulmalı:

```bash
gcloud run services update "$SERVIS" \
  --set-secrets "AUTH_SECRET=aisigner-auth-secret:latest" \
  --set-secrets "SENTRY_DSN=aisigner-sentry-dsn:latest"
```

⚠️ `AUTH_SECRET` **tek sırdır**: oturum, e-posta doğrulama ve şifre sıfırlama
token'larının üçü de bununla imzalanır. Döndürmek tüm oturumları ve bekleyen
bağlantıları geçersiz kılar.

⚠️ `SENTRY_DSN` tanımlı olsa bile `features/legal/kvkk.ts` içindeki
`HATA_TESHIS` `null` ise Sentry **kendini açmaz** (#519) — beyan edilmemiş
yurt dışı aktarımı kod düzeyinde engelli.

---

## 10. Dağıtım komutları (özet)

```bash
PROJE=<proje-id>; BOLGE=europe-west1; SERVIS=aisigner
IMAJ="$BOLGE-docker.pkg.dev/$PROJE/aisigner/app:$(git rev-parse --short HEAD)"

gcloud artifacts repositories create aisigner \
  --repository-format=docker --location="$BOLGE"
gcloud auth configure-docker "$BOLGE-docker.pkg.dev"

docker build --build-arg NEXT_PUBLIC_APP_URL="https://<alan-adiniz>" \
             --build-arg APP_VERSION="$(git rev-parse --short HEAD)" -t "$IMAJ" .
docker push "$IMAJ"

gcloud run deploy "$SERVIS" \
  --image="$IMAJ" --region="$BOLGE" \
  --service-account="$SA" \
  --add-cloudsql-instances "$PROJE:$BOLGE:$ORNEK" \
  --no-cpu-throttling --min-instances=1 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJE,GCS_BUCKET=$BUCKET,NEXTAUTH_URL=https://<alan-adiniz>" \
  --set-secrets "AUTH_SECRET=aisigner-auth-secret:latest,DATABASE_URL=aisigner-db-url:latest"
```

⚠️ `HOSTNAME` ve `PORT` listede **bilerek yok** (§5). `NEXT_PUBLIC_APP_URL`
çalışma zamanında değil **build-arg** olarak veriliyor (§7).

---

## 11. Dağıtım sonrası kontrol listesi

- [ ] `GET /api/health` → `status: ok`, `db: connected`, doğru `version`
- [ ] Oturumsuz `/api/...` → **401 JSON** (307 + HTML DEĞİL, #375)
- [ ] Giriş yapıp sayfayı yenile — panoda kalıyor mu? (#308)
- [ ] `DEPLOYMENT.md §7` vekil testi yapıldı, `TRUSTED_PROXY_HOPS` ayarlandı
- [ ] Dosya yükleme GCS'e yazıyor (`GCS_BUCKET`, #197)
- [ ] AI analizi **gerçek** çıktı üretiyor. Kartta "Yapay zekâ üretmedi"
      yazıyorsa kimlik/IAM eksiktir (#519 köken şeridi bunu söyler)
- [ ] `SENTRY_DSN` girildiyse deneme hatası Sentry'de görünüyor
- [ ] `DEPLOYMENT.md §8` yedekleme provası Cloud SQL üzerinde tekrarlandı
