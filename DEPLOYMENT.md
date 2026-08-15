# AISigner — Dağıtım (Deployment) Rehberi

Bu belge AISigner'ı **Out Plane** (yönetilen PostgreSQL + Docker/GitHub build) veya
benzeri bir PaaS üzerinde **güvenli** biçimde canlıya almak içindir.

> Mimari özet için `CLAUDE.md`, çok-instance/ölçekleme notları için ilgili başlığa bakın.

---

## 1. Mimari ve gereksinimler

| Bileşen | Değer |
|---|---|
| Runtime | Node 20 (Docker imajı: `node:20-bookworm-slim`) |
| Uygulama | Next.js 15 standalone, port **3000** |
| Veritabanı | PostgreSQL 14–18, **SSL zorunlu** |
| AI (opsiyonel) | Google Vertex AI / Gemini — kimlik JSON'u env'den |
| Dosya yükleme | Yerel disk `/app/uploads` (kalıcılık için Volume gerekir) |

Konteyner açılışta şunu yapar (`docker-entrypoint.sh`):
1. `GCP_CREDENTIALS_JSON` env'i varsa `/app/gcp-credentials.json`'a **600 izinle** yazar.
2. `npx prisma migrate deploy` — bekleyen şema göçlerini uygular.
3. Uygulamayı başlatır. **Root değil, `node` kullanıcısı** olarak koşar.

---

## 2. Ortam değişkenleri (Environment variables)

Out Plane konsolunda servisin **Variables** bölümüne girilir.

### Zorunlu

| Değişken | Açıklama | Örnek / Not |
|---|---|---|
| `DATABASE_URL` | Postgres bağlantısı. **`?sslmode=require` ekleyin.** | `postgresql://user:pass@host:5432/aisigner?sslmode=require` |
| `AUTH_SECRET` | **JWT imzalama sırrı** (oturum + middleware). Yoksa uygulama prod'da açılmaz. **Yeni ve güçlü üretin.** | `openssl rand -base64 32` çıktısı |
| `NEXTAUTH_URL` | Uygulamanın public URL'i (NextAuth callback'leri). | `https://aisigner.example.com` |

> **Dikkat:** Bu proje NextAuth v4 ile **`AUTH_SECRET`** kullanır (`NEXTAUTH_SECRET` DEĞİL).
> Bir platform şablonu `NEXTAUTH_SECRET` isterse, `AUTH_SECRET`'i mutlaka ayrıca girin.

### Güvenlik için önerilen

| Değişken | Açıklama |
|---|---|
| `NEXTAUTH_SECRET` | Parola-sıfırlama token'larının imzalanmasında kullanılır. Verilmezse sabit bir decoy fallback devreye girer → token'lar tahmin edilebilir olur. **Ayrı, güçlü bir değer girin.** |

### AI için (opsiyonel — verilmezse AI özellikleri mock'a düşer)

| Değişken | Açıklama |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | GCP proje kimliği (ör. `projects-498900`). |
| `GCP_CREDENTIALS_JSON` | Service-account JSON'unun **tam içeriği** (dosya değil). Açılışta dosyaya yazılır. |

> **`GOOGLE_APPLICATION_CREDENTIALS` girmeyin** — entrypoint onu otomatik `/app/gcp-credentials.json`'a ayarlar.

### Diğer (opsiyonel)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://aisigner.com` | **#204/SEO** — `robots.txt`, `sitemap.xml` ve canonical/OG URL'lerinin taban adresi. Gerçek domain'e ayarlanmazsa fallback kullanılır. ⚠️ **`NEXT_PUBLIC_` = build-time**: değeri **imaj build edilirken** mevcut olmalı (yalnız runtime env yetmez). Aşağıya bak. |
| `GCS_BUCKET` | _(yok)_ | **#197** — Dosya yüklemelerinin kalıcılığı. Verilirse yüklemeler bu GCS bucket'ına yazılır (deploy'da silinmez, çok-instance ölçeklenir). Kimlik: mevcut `GCP_CREDENTIALS_JSON` (ADC). Verilmezse yerel disk. |
| `GITHUB_TOKEN` | _(yok)_ | **#179** — Gerçek GitHub entegrasyonu. Verilirse öğrenci çalışma alanı reposu, milestone ve AI issue'ları GitHub'da fiziksel olarak açılır. Verilmezse simülasyon/önizleme fallback devreye girer. **Minimum yetki** için aşağıya bakın. |

> **`GITHUB_TOKEN` — en az yetki ilkesi (#179):** Uygulama yalnızca **repo oluşturur** ve
> **issue/milestone yazar**; organizasyon üyeliği/ayarı yönetmez. Bu yüzden **`admin:org`
> VERMEYİN** (gereğinden fazla yetki).
> - **Fine-grained token (önerilen):** Repository → *Contents: Read & write*, *Issues: Read & write*,
>   *Metadata: Read*. Org altında repo açacaksa Organization → *Administration: Read & write*
>   (yalnız repo oluşturma için).
> - **Klasik PAT:** `repo` yeterlidir (org repo oluşturma izni org ayarlarından verilir).
>
> Token yalnızca platform secret'ı olarak tutulur; kodda loglanmaz.
| `GITHUB_ORG` | `Posinowa` | GitHub çalışma alanı URL'lerinde ve repo oluşturma işlemlerinde kullanılan organizasyon veya kullanıcı adı. |
| `PORT` | `3000` | Platform farklı bir port dayatıyorsa. |

> **`NEXT_PUBLIC_APP_URL` build-time notu:** Next.js `NEXT_PUBLIC_*` değişkenlerini **build sırasında**
> bundle'a gömer. Out Plane GitHub-connect ile build ederken servis değişkenlerini build'e de
> enjekte ediyorsa değeri girmen yeterlidir. Değilse (ör. saf `docker build`), Dockerfile'ın builder
> aşamasına build-arg olarak geçmen gerekir. Verilmezse robots/sitemap `https://aisigner.com`'a işaret eder.

---

## 3. Out Plane adımları

1. **PostgreSQL oluştur**: Out Plane'de yönetilen Postgres ekle; bağlantı dizesini al,
   sonuna `?sslmode=require` ekleyip `DATABASE_URL` olarak kaydet.
2. **Servis oluştur**: Repo'yu (`Posinowa/AISigner`) bağla — Out Plane kök dizindeki
   `Dockerfile` ile imajı kendisi build eder. (Alternatif: hazır imaj push'la.)
3. **Değişkenleri gir**: Yukarıdaki tablodaki tüm zorunlu + kullanacağın opsiyonel değişkenler.
4. **Deploy et.** İlk açılışta `migrate deploy` şemayı kurar. Logda şunları görmelisin:
   `→ Prisma migrate deploy çalışıyor...` ve `→ Uygulama başlatılıyor...`.
5. **Doğrula**: `https://<url>/api/health` 200 dönmeli; ardından `/signin`.

### İlk admin'i güvenli oluştur (#206)

`npm run seed` **prod'da ÇALIŞTIRILMAZ** — zayıf demo admin (`admin@example.com`) açar.
Gerçek yöneticiyi **`scripts/create-admin.ts`** ile oluştur: kimlik bilgileri **ortam
değişkeninden** okunur (repoya hardcode edilmez, parola loglanmaz), argon2 ile hash'lenir,
ADMIN + APPROVED olarak **idempotent** upsert edilir (aynı komut parola sıfırlamak için de
kullanılabilir).

Bir **dev makineden**, prod DB'ye SSL ile bağlanarak tek sefer çalıştır:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require" \
ADMIN_EMAIL="admin@posinowa.com" \
ADMIN_PASSWORD="<güçlü-parola>" \
npm run create:admin
```

> **Not:** `tsx` bir dev bağımlılığıdır; prod imajında (`--omit=dev`) yoktur. Bu yüzden script,
> imaj içinde değil, `tsx`'in bulunduğu bir dev makineden prod `DATABASE_URL`'ine karşı çalıştırılır.
> `ADMIN_PASSWORD`'ü terminal geçmişine yazmamak için tek satırda inline env olarak ver.

---

## 4. 🔒 Güvenlik kontrol listesi (deploy öncesi)

- [ ] **`gcp-credentials.json` repoda YOK.** `.gitignore` + `.dockerignore` korur; imaja da girmez.
- [ ] **`.env` repoda YOK.** Tüm sırlar platformun Variables bölümünde.
- [ ] **`NEXTAUTH_SECRET` yeni üretildi** (`openssl rand -base64 32`) — demo/örnek değer DEĞİL.
- [ ] **`DATABASE_URL` içinde `sslmode=require`** var.
- [ ] **Prod'da `npm run seed` çalıştırılmadı.** Seed; `admin@example.com` / `mentor@example.com`
      / `student@example.com` kullanıcılarını **sabit zayıf parola** ile açar — canlıda arka kapı olur.
- [ ] İlk admin **güçlü, benzersiz parolayla** oluşturuldu.
- [ ] Konteyner **root değil** (`node` kullanıcısı) — Dockerfile bunu sağlar.
- [ ] `GCP_CREDENTIALS_JSON` yalnızca platform secret'ı olarak duruyor; logda içeriği görünmüyor.

---

## 5. Kalıcılık ve ölçekleme (dikkat)

- **Dosya yüklemeleri (kalıcılık)** — iki seçenek (#197):
  - **`GCS_BUCKET` ver (önerilen):** yüklemeler GCS'e yazılır, deploy'da silinmez, çok-instance
    ölçeklenir. Ek kimlik gerekmez (mevcut `GCP_CREDENTIALS_JSON` kullanılır). Bucket'ı önceden
    oluştur; servis hesabına `Storage Object Admin` yetkisi ver.
  - **`GCS_BUCKET` verme:** yerel disk `/app/uploads`. Volume bağlanmazsa **her deploy'da silinir**;
    kalıcılık için Out Plane Volume'ünü `/app/uploads`'a bağla (tek-instance).
- **Tek-instance varsayımı**: `rate-limit.ts`, forgot-password token'ları ve `metrics.ts`
  bellek-içi (process-local) tutulur. **Birden çok instance** çalıştıracaksanız bunlar
  instance'lar arasında paylaşılmaz → Redis'e taşıyın. Tek instance ile sorun yok.
