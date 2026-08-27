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

### E-posta (SMTP) — doğrulama ve şifre sıfırlama için ZORUNLU

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `SMTP_HOST` | _(yok)_ | SMTP sunucusu. **Üçü de (host/user/pass) verilmezse e-posta tamamen devre dışı kalır.** |
| `SMTP_USER` | _(yok)_ | SMTP kullanıcı adı. |
| `SMTP_PASS` | _(yok)_ | SMTP parolası. Asla loglanmaz. |
| `SMTP_PORT` | `587` | 465 → örtük TLS, 587 → STARTTLS. |
| `SMTP_SECURE` | port'a göre | `true`/`false` ile elle geçilebilir. |
| `MAIL_FROM` | `SMTP_USER` | Gönderen adresi. Çoğu sunucu SMTP hesabından farklı bir adresi reddeder. |

> **Sessiz başarısızlık uyarısı:** `sendMail` sözleşme gereği hata FIRLATMAZ — yapılandırma
> eksikse yalnızca bir uyarı loglar ve `{ sent: false }` döner. Kayıt akışı e-posta yüzünden
> kırılmasın diye böyle. Sonucu: SMTP verilmeden canlıya çıkılırsa **doğrulama e-postaları ve
> şifre sıfırlama bağlantıları hiç gitmez**, kullanıcılar kalıcı olarak "Doğrulanmamış" kalır
> ve parolasını unutan hesap kurtarılamaz. Hiçbir yerde hata görünmez.

**Doğrulama:** Test hesabıyla kayıt olup doğrulama e-postasının ulaştığını, ardından
"Şifremi Unuttum" akışının bağlantı gönderdiğini teyit edin.

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
| `GITHUB_TOKEN` | _(yok)_ | **#218** — Verilirse GitHub'da **gerçek** repo/milestone/issue oluşturulur. Verilmezse sistem önizleme (simülasyon) modunda kalır: bağlantılar türetilir ama GitHub'da hiçbir şey yaratılmaz. Gerekli yetkiler aşağıda. |
| `GITHUB_ORG` | `Posinowa` | GitHub çalışma alanı URL'lerinde kullanılan org. **Tanımlı ama boş bırakılırsa** entegrasyon bilerek devre dışı kalır — sessizce varsayılana düşmek yanlış hesapta repo açmaya yol açabilir. |
| `PORT` | `3000` | Platform farklı bir port dayatıyorsa. |

### GitHub token yetkileri (#218)

Token **yalnızca sunucu tarafında** okunur ve hiçbir log'a yazılmaz.

**Minimum yetki** — organizasyon altında repo açmak için:

| Token tipi | Gerekli |
|---|---|
| Fine-grained PAT | Organizasyona erişim + `Repository: Administration (write)`, `Issues (write)`, `Contents (read)` |
| Classic PAT | `repo` (özel repo açmak için tamamı) |

Repolar **private** açılır ve `auto_init` ile başlatılır.

**Önizleme → gerçek geçişi:** `GITHUB_TOKEN` tanımlanmadan önce oluşturulmuş çalışma
alanlarının kayıtlı URL'leri simülasyondan gelmedir ve GitHub'da karşılığı yoktur. Token
tanımlandıktan sonra ilgili atamada **Güncelle**'ye basmak repo adını kayıtlı URL'den
alacağı için o eski adla gerçek repo açmaya çalışır. Temiz başlangıç isteniyorsa
`AssignedProject.githubRepoUrl` alanını boşaltıp `githubStatus`'ü `NOT_PROVISIONED`
yapın; sonraki kurulum adı yeniden türetir.

**Üretimde `GITHUB_TOKEN` ZORUNLUDUR (#179).** Token tanımlı değilken önizleme modu
yalnızca geliştirmede çalışır; `NODE_ENV=production` altında çalışma alanı oluşturma
**hata verir**. Sebebi: önizleme veritabanına sahte repo/issue URL'leri yazıp atamayı
`PROVISIONED` damgalıyordu — admin "oluşturuldu" görüyor, öğrenci 404 veren bağlantıya
tıklıyor ve kayıt sonradan gerçek kurulumdan ayırt edilemiyordu.

**Doğrulama:** Admin panelinde *Öğrenci Proje İlerlemesi & GitHub Yönetimi* sayfası
hangi modda olduğunuzu üstte gösterir (önizleme / gerçek).

---

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
- [ ] **`GITHUB_TOKEN` tanımlı.** Üretimde eksikse proje atama hata verir (#179) — önizleme
      modu yalnızca geliştirmede geçerlidir.

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

---

## 6. 🚀 Canlıya Alma (Cutover) Kontrol Listesi (#201)

Canlı ortama ilk çıkış veya ana sürüm geçişlerinde şu adımlar sırayla tamamlanmalıdır:

1. **GCS Depolama Doğrulaması:**
   - [ ] GCP Cloud Storage üzerinde bucket oluşturuldu (ör. `aisigner-prod-uploads`).
   - [ ] Service account'a `roles/storage.objectAdmin` yetkisi verildi.
   - [ ] Out Plane değişkenlerine `GCS_BUCKET=aisigner-prod-uploads` eklendi.
   - [ ] Bir dosya yüklenip indirildiği ve DB bağlantı kesintisinde orphan dosya temizliğinin çalıştığı doğrulandı.

2. **Veritabanı ve Şema Geçişi:**
   - [ ] `DATABASE_URL`'in `sslmode=require` parametresi taşıdığı teyit edildi.
   - [ ] `npx prisma migrate deploy`'un `docker-entrypoint.sh` üzerinden hatasız tamamlandığı loglandı.
   - [ ] M:N mentör atama tablosu (`MentorAssignment`) kayıtlarının sağlıklı ilişkilendirildiği doğrulandı.

3. **E-posta Gönderimi:**
   - [ ] `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` tanımlandı (eksikse e-posta SESSİZCE devre dışı kalır).
   - [ ] Test kaydıyla doğrulama e-postasının ulaştığı görüldü.
   - [ ] "Şifremi Unuttum" akışının bağlantı gönderdiği görüldü.

4. **İlk Yönetici & Sistem Kontrolü:**
   - [ ] `ADMIN_EMAIL` ve `ADMIN_PASSWORD` ile `npm run create:admin` çalıştırılarak ilk yönetici açıldı.
   - [ ] `/api/health` uç noktası `200 OK` döndü.
   - [ ] Admin dashboard ve mentör/öğrenci akışları canlı ortamda duman testinden (smoke test) geçirildi.

