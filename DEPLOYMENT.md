# AISigner — Dağıtım (Deployment) Rehberi

Bu belge AISigner'ı **Out Plane** (yönetilen PostgreSQL + Docker/GitHub build) veya
benzeri bir PaaS üzerinde **güvenli** biçimde canlıya almak içindir.

> Mimari özet için `CLAUDE.md`, çok-instance/ölçekleme notları için ilgili başlığa bakın.

---

## 1. Mimari ve gereksinimler

| Bileşen | Değer |
|---|---|
| Runtime | Node 20 (Docker imajı: `node:20-bookworm-slim`) |
| Uygulama | Next.js 15 **standalone** çıktısı (`node server.js`), port **3000**. İmaj ~970 MB; runner'da `npm install` yoktur. Migration için Prisma CLI ayrı bir katmanda `/app/.migrator` altında taşınır. |
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

> **`NEXTAUTH_SECRET` GİRMEYİN.** Bu proje NextAuth v4'ü `AUTH_SECRET` ile
> yapılandırır ve kodda `NEXTAUTH_SECRET` hiç okunmaz. Parola-sıfırlama ve
> e-posta-doğrulama token'ları da (`lib/auth/reset-token.ts`,
> `lib/auth/verification-token.ts`) `AUTH_SECRET` ile HMAC imzalanır.
> Ayrı bir `NEXTAUTH_SECRET` girmek işe yaramaz; iki sırrı ayrı sanmak
> rotasyon sırasında yanlışını değiştirmene yol açar.

### Güvenlik için önerilen

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `TRUSTED_PROXY_HOPS` | `1` | Uygulamanın ÖNÜNDEKİ güvenilen ters vekil sayısı. Rate-limit'in istemci IP'sini `X-Forwarded-For` zincirinden **sağdan** kaçıncı girdiden okuyacağını belirler (`lib/client-ip.ts`). Tek PaaS yönlendiricisi → `1` (varsayılan, çoğu kurulum). Önde ayrıca CDN varsa (Cloudflare + platform LB) → `2`. **Fazla büyük vermeyin:** zincir kısa kalırsa istemcinin uydurduğu değere düşülür ve rate-limit atlatılabilir hale gelir. |

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
| `GITHUB_WEBHOOK_SECRET` | _(yok)_ | **#326** — GitHub'dan gelen olayların (issue kapandı, PR merge edildi) HMAC imzasını doğrular. GitHub'da webhook oluştururken girdiğiniz **Secret** ile aynı olmalı. **Tanımsızsa uç 503 döner** ve hiçbir olay işlenmez — bu bilinçli: "sır yoksa geç" davranışı, kimlik doğrulamasız public bir ucu tamamen açık bırakırdı. Üret: `openssl rand -hex 32`. |
| `GITHUB_ORG` | `Posinowa` | GitHub çalışma alanı URL'lerinde kullanılan org. **Tanımlı ama boş bırakılırsa** entegrasyon bilerek devre dışı kalır — sessizce varsayılana düşmek yanlış hesapta repo açmaya yol açabilir. |
| `PORT` | `3000` | Platform farklı bir port dayatıyorsa. |
| `ERROR_ALERT_EMAIL` | _(yok)_ | **#316** — Üretimdeki yakalanmamış sunucu hatalarının bildirileceği operatör adresi. **Tanımsızsa özellik kapalıdır.** SMTP'ye bağımlıdır: `sendMail` hata fırlatmadığı için SMTP eksikse bildirim de sessizce gitmez (gönderim sonucu loglanır). Aynı hata en fazla 15 dk'da bir bildirilir; aradaki tekrarlar sayılıp bir sonraki iletide raporlanır — susturma olmadan bir hata seli SMTP hesabınızı kısıtlatabilir. |
| `GIT_COMMIT_SHA` | _(yok)_ | **#10** — `/api/health`'in `version` alanı. Deploy sonrası "yeni sürüm gerçekten yayında mı?" kontrolünü (§8.5) anlamlı kılan tek şey. Platform commit SHA'sını başka bir adla veriyorsa (`RAILWAY_GIT_COMMIT_SHA`, `SOURCE_COMMIT`) route onları da okur. Hiçbiri yoksa imaj build'inde `--build-arg APP_VERSION=<sha>` geçilebilir; o da yoksa `version` **"bilinmiyor"** döner. |

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
- [ ] **`AUTH_SECRET` yeni üretildi** (`openssl rand -base64 32`) — demo/örnek değer DEĞİL.
      (`NEXTAUTH_SECRET` diye ayrı bir değişken YOK; bkz. §2.)
- [ ] **`TRUSTED_PROXY_HOPS` platformun vekil sayısıyla uyumlu.** Yanlışsa rate-limit
      atlatılabilir — doğrulaması aşağıda (§7).
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
- **Rate-limit artık ÇOK-INSTANCE GÜVENLİ (#322)**: sayaçlar veritabanında
  (`RateLimit` tablosu) tutuluyor ve artırma tek atomik SQL ifadesiyle yapılıyor.
  Öncesi süreç belleğindeydi ve birden çok instance'ta brute-force koruması
  **sessizce** zayıflıyordu (5 denemelik limit 3 pod'da fiilen 15 oluyordu).
  Redis gerekmiyor — veritabanı zaten var.
  - ⚠️ **Fail-open**: veritabanına ulaşılamazsa istek GEÇİRİLİR ve durum loglanır.
    Kesintide tüm girişleri kilitlememek için bilinçli karar; rate-limit bir
    savunma-derinliği katmanı, kimlik doğrulamanın kendisi değil.
- **`metrics.ts` hâlâ süreç-yerel**: yalnız teşhis amaçlı sayaçlar, instance
  başına ayrı sayar. Güvenlik etkisi yok.
  - Şifre-sıfırlama ve e-posta-doğrulama token'ları **artık bellekte DEĞİL**: durumsuz
    HMAC (`AUTH_SECRET` ile imzalı), çok-instance'ta sorunsuz çalışır.

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

---

## 7. Ters vekil (proxy) doğrulaması — rate-limit'in gerçekten çalıştığını teyit et

Rate-limit anahtarı istemci IP'sidir ve IP `X-Forwarded-For` zincirinden **sağdan**
`TRUSTED_PROXY_HOPS` kadar sayılarak okunur (`lib/client-ip.ts`). Sayı yanlışsa limit ya
herkesi tek kovaya toplar (meşru kullanıcılar birbirini kilitler) ya da istemcinin
uydurduğu değere düşer (**limit tamamen atlatılır**).

Deploy sonrası tek seferlik doğrulama:

```bash
for i in 1 2 3 4 5 6 7; do
  curl -s -o /dev/null -w "%{http_code}
"     -X POST https://<alan-adi>/api/auth/reset-password     -H "Content-Type: application/json"     -H "X-Forwarded-For: 9.9.9.$i"     -d '{"email":"yok@example.com"}'
done
```

- [ ] Son istekler **429** dönüyor → doğru. Uydurma `X-Forwarded-For` limiti atlatamıyor.
- [ ] Hepsi **200** dönüyor → `TRUSTED_PROXY_HOPS` yanlış. Platformun uygulamaya ulaştırdığı
      ham `X-Forwarded-For` zincirini loglayıp kaç girdi geldiğini sayın ve değeri düzeltin.

---

## 8. 💾 Yedekleme ve geri dönüş (backup & rollback)

> Bu bölüm daha önce hiç yoktu. Yedeği olmayan bir sistemde ilk ciddi hata,
> kurtarılamayan bir veri kaybıdır — ve bunu fark ettiğiniz an yedek almak için
> çok geçtir. **Canlıya çıkmadan önce en az bir kez geri yükleme provası yapın.**

### 8.1 Neyin yedeği alınmalı

| Veri | Nerede | Kaybedilirse |
|---|---|---|
| **PostgreSQL** | Yönetilen DB | Her şey: kullanıcılar, yol haritaları, sertifikalar. Kurtarılamaz. |
| **Yüklenen dosyalar** | `GCS_BUCKET` ya da `/app/uploads` | Öğrenci teslimleri. DB'deki `StepFile` satırları öksüz kalır. |
| **Sırlar** (`AUTH_SECRET` vb.) | Platform Variables | `AUTH_SECRET` kaybolursa tüm oturumlar + bekleyen sıfırlama/doğrulama bağlantıları geçersiz olur (parolalar etkilenmez). |

> ⚠️ `AUTH_SECRET`'i yedekleyin ve **rotasyonun bedelini bilin**: değiştirdiğiniz an
> herkes sistemden atılır ve gönderilmiş tüm şifre-sıfırlama / e-posta-doğrulama
> bağlantıları ölür (ikisi de bu sır ile HMAC imzalanıyor).

### 8.2 Yedek alma

Out Plane'in yönetilen Postgres'i otomatik yedek sunuyorsa **onu açın** ve saklama
süresini not edin. Ek olarak, elle bir anlık görüntü (özellikle **her deploy öncesi**):

```bash
pg_dump --format=custom --no-owner --no-privileges \
  "postgresql://user:pass@host:5432/aisigner?sslmode=require" \
  > aisigner-$(date +%Y%m%d-%H%M).dump
```

Dosyalar için `GCS_BUCKET` kullanıyorsanız bucket'ta **Object Versioning**'i açın;
yerel diskteyseniz volume anlık görüntüsü alın.

### 8.3 Geri yükleme provası (canlıya çıkmadan ÖNCE, bir kez)

Yedeğin var olması yetmez — geri yüklenebildiği **kanıtlanmalıdır**.

```bash
createdb aisigner_restore_test
pg_restore --no-owner --no-privileges -d aisigner_restore_test aisigner-YYYYMMDD-HHMM.dump
psql -d aisigner_restore_test -c 'SELECT count(*) FROM "User";'
```

- [ ] `pg_restore` hatasız tamamlandı
- [ ] Satır sayıları canlıyla tutarlı
- [ ] Test veritabanı sonrasında silindi

### 8.4 Sürüm geri alma (rollback)

**Uygulama kodu** — platformdan bir önceki imaja/deploy'a dön. Kod geri alma
genelde güvenlidir; **tehlike şemadadır**.

**Şema** — `prisma migrate deploy` ileri yönlüdür, otomatik geri alma **yoktur**.
Bu yüzden `docs/MIGRATIONS.md`'deki **expand/contract** kuralı yalnız bir stil
tercihi değil, rollback'i mümkün kılan şeydir:

- **Yalnızca eklemeli (additive) migration** → eski kod yeni şemayla çalışmaya
  devam eder, kodu geri almak **yeterlidir**. Güvenli durum.
- **Yıkıcı migration** (kolon/tablo silme, rename, NOT NULL) → eski kod yeni
  şemada **çalışmaz**. Kodu geri almak yetmez; yedekten dönmek gerekir ve
  **migration'dan sonraki tüm veri kaybedilir**.

> Bu nedenle: yıkıcı bir migration'ı **asla** aynı deploy'da göndermeyin.
> CI'daki `check:migrations` guard'ı (#198) bunu zaten engelliyor — `-- migration-safety-ack:`
> ile geçmeden önce yedeğinizin tazeliğini teyit edin.

**Sıralama (yıkıcı olmayan deploy için):**

1. Deploy öncesi `pg_dump` al.
2. Deploy et, `/api/health`'in **200** ve `version` alanının yeni commit'i
   gösterdiğini teyit et.
3. Sorun varsa platformdan önceki imaja dön; şema eklemeli olduğu için müdahale gerekmez.
4. Şema geri alınmak zorundaysa: uygulamayı durdur → yedekten geri yükle → eski imajı başlat.

### 8.5 Deploy sonrası hızlı doğrulama

```bash
curl -s https://<alan-adi>/api/health
```

- [ ] `status: "ok"`, `db: "connected"`
- [ ] `version` **beklenen commit** — eski değer görünüyorsa yeni sürüm yayına çıkmamıştır.
      `"bilinmiyor"` görüyorsanız sürüm damgası hiç ayarlanmamış demektir: `GIT_COMMIT_SHA`
      çalışma-anı değişkenini girin ya da imajı `--build-arg APP_VERSION=<sha>` ile kurun.
      Damga olmadan bu kontrol hiçbir şey doğrulamaz.
- [ ] `uptimeSeconds` küçük (yeniden başlatıldığını doğrular)

---

## 9. 🔔 Hata bildirimi (#316)

Loglar üretimde yapısal JSON (§bkz. `lib/logger.ts`) — yani *aranabilir*. Ama **log
yazmak ile haberdar olmak aynı şey değil**: birinin bakması gerekir. Bu yüzden
yakalanmamış sunucu hataları ayrıca e-posta ile bildirilir
(`src/instrumentation.ts` → `lib/error-alerts.ts`).

**Açmak için:** `ERROR_ALERT_EMAIL` girin (SMTP zaten yapılandırılmış olmalı).
Tanımsızsa özellik kapalıdır ve uygulama hiçbir şekilde etkilenmez.

**Doğrulama:** aşağıdaki uç kasıtlı olarak yoktur, bu yüzden 404 döner ve bildirim
üretmez. Gerçek doğrulama için deploy sonrası bir hata oluştuğunda kutunuzu kontrol
edin; ya da geçici olarak `ERROR_ALERT_EMAIL`'i kendi adresinize alıp bilinen bir
hatayı tetikleyin.

- [ ] `ERROR_ALERT_EMAIL` tanımlı ve okunan bir kutuya gidiyor
- [ ] SMTP çalışıyor (§2'deki test kaydı akışı ile teyit edilmiş olmalı)

> ⚠️ **Susturma tek instance içindir.** Sayaçlar bellekte (`metrics.ts` ile aynı
> kısıt; rate-limit #322'de veritabanına taşındı). Çok instance çalıştırılırsa her
> instance kendi susturmasını uygular ve bildirim sayısı instance sayısıyla
> çarpılır — gürültü artar ama veri kaybı olmaz.

> ⚠️ **Bildirim e-postası yığın izi taşır.** Yığın izi ve hata mesajı kullanıcı
> verisi içerebilir. Adresin operatöre ait, erişimi sınırlı bir kutu olduğundan
> emin olun. Sorgu dizesi bilerek bildirime konmaz (PII sıklıkla oradadır).

---

## 10. 🔗 GitHub webhook kurulumu (#326)

Issue kapandığında veya PR merge edildiğinde AISigner'daki yol haritası adımı
otomatik olarak tamamlanır. Bunun için GitHub'ın olayları bize göndermesi gerekir.

**GitHub tarafı** — repo (veya org) → Settings → Webhooks → Add webhook:

| Alan | Değer |
|---|---|
| Payload URL | `https://<alan-adi>/api/webhooks/github` |
| Content type | `application/json` |
| Secret | `GITHUB_WEBHOOK_SECRET` ile **aynı** değer |
| Events | "Let me select individual events" → **Issues** ve **Pull requests** |

**Doğrulama:**

- [ ] GitHub'daki webhook sayfasında "Recent Deliveries" sekmesinde son teslimat **200** dönmüş
- [ ] Bir test issue'su kapatıldığında ilgili adım panelde tamamlandı görünüyor
- [ ] `GITHUB_WEBHOOK_SECRET` girilmeden test edilirse **503** dönüyor (sessizce başarılı görünmüyor)

> ⚠️ **Uç kimlik doğrulamasız ve public** (middleware `publicPaths`'inde). Tek koruma
> HMAC imzası. Sır rotasyonunda GitHub'daki değeri de güncellemeyi unutmayın —
> aksi halde tüm teslimatlar 401 alır ve adımlar sessizce senkronize olmaz.
>
> Aynı teslimat iki kez gelirse (GitHub yeniden dener) ikinci kez işlenmez;
> `ProcessedWebhook` tablosu teslimat kimliğini tutuyor.
