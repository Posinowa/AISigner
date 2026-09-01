# AISigner — Proje Hafızası (CLAUDE.md)

Bu dosya Claude'un (ve yeni geliştiricilerin) AISigner projesini hızla anlaması içindir.
Kaynak dosyaları baştan taramak yerine önce burayı okuyun.

---

## Projeye Genel Bakış

**AISigner** — Mentör-stajyer eşleştirme ve yapay zeka destekli staj/proje yönetim platformu.

- **Stack**: Next.js 15.5.x (App Router), TypeScript strict, Tailwind CSS v4 (tokenlar `globals.css` `@theme`), shadcn/ui
- **Auth**: NextAuth v4, JWT strateji, Credentials provider, argon2 hash
- **DB**: PostgreSQL + Prisma ORM v6 (`prisma/schema.prisma`, migration tabanlı)
- **AI**: Google Vertex AI / **Gemini 2.5 Flash** (`@google-cloud/vertexai`). Bağlantı testi: `npm run test:ai`
- **Test**: vitest (`npm test`) — route testleri `vi.hoisted` mock deseni, saf lib testleri
- **Validation**: Zod v4 (`src/lib/validations/api.ts` — tüm API şemaları burada)

## Takım Çalışma Akışı (ÖNEMLİ)

- Depo: `Posinowa/AISigner`. **Default branch: `develop`** (main yalnızca release).
- Her iş bir GitHub **issue** ile başlar; **1 PR = 1 issue**.
- Branch adı: `<type>/issue-<no>-<kısa-başlık>` (type: feature|fix|chore|refactor|ci|docs).
- PR başlığı `feat:`/`fix:`/... ile başlar; body'de **`Closes #N`** zorunlu.
- **PR Guard** bunları otomatik denetler; `.env`, `gcp-credentials.json` vb. yasak dosyalar commit edilirse FAIL.
- Detay: `CONTRIBUTING.md`. Merge sonrası: `docs/SMOKE-CHECKLIST.md`.

### ⚠️ CI tuzakları (yaşanmış)
- CI **Node 20 / npm 10** kullanır. `package-lock.json`'a dokunacak işlemleri
  **`npx -y npm@10 install ...`** ile yapın — npm 11 lockfile'ı CI'da `npm ci`
  EUSAGE hatasına yol açar (esbuild/@emnapi girdileri uyumsuz kalır).
- Native binding'li dev bağımlılıklarında (ör. rolldown tabanlı araçlar) Linux
  binary'lerinin lockfile'da çözüldüğünden emin olun.

## Klasör Yapısı (özet)

```
src/
├── app/
│   ├── (admin)/admin-dashboard/          — kullanıcı/rol/mentor/onay yönetimi + projects
│   ├── (auth)/signin|signup|forgot-password|reset-password|signout/
│   ├── (mentor)/mentor-dashboard/        — öğrenci detay + roadmap yönetimi
│   ├── (mentor)/mentor-profile-setup/    — mentör başvuru soruları (#287, PENDING iken)
│   ├── (student)/student-dashboard|profile-setup|student-onboarding/
│   ├── account-status/                   — PENDING/REJECTED stajyer ekranı (#39)
│   ├── terms|privacy/                    — public hukuki metinler (#171)
│   ├── verify-certificate/[no]/          — public sertifika doğrulama (#208)
│   └── api/  — admin/(users|approval|project-templates|survey-questions|students/analysis),
│              auth/, mentor/, student/(ai-chat|steps|survey-answers), steps/, messages/
├── features/
│   ├── admin/server/user.ts              — getAllUsers (select ile, hash sızdırmaz), onay
│   ├── ai/server/                        — profile-analysis(+store), recommendations, roadmap
│   ├── ai/ui/                            — AIChatBot (Posilog), ProfileAnalysisCard
│   ├── student/models/                   — onboarding, compiledGoals, onboardingInitial
│   ├── suggestions/                      — öneri/istek: labels + server (#147)
│   ├── survey/                           — answers + server/survey (#45/#46)
│   └── mentors|messaging|projects|files|auth/...
└── lib/
    ├── ai/gemini-client.ts               — getModel() JSON / getTextModel() düz metin
    ├── auth/guard.ts                     — requireAuth(role[]) + STUDENT accountStatus kontrolü
    ├── auth/nextauth.ts                  — login rate-limit, timing-safe verify, JWT'de
    │                                       rol+durum her istekte DB'den tazelenir (#44)
    ├── validations/api.ts                — tüm Zod şemaları (github URL'leri dahil)
    ├── rate-limit.ts — ASENKRON, sayaçlar DB'de, atomik (#322) · logger.ts
    ├── metrics.ts · experience-level.ts
    ├── file-signature.ts                 — upload magic-byte doğrulaması (#113)
    ├── api-error-message.ts              — string/fieldErrors → tek mesaj (#114)
    ├── client-ip.ts                      — rate-limit için GÜVENİLİR istemci IP (#308)
    ├── security-headers.ts               — CSP + güvenlik başlıkları (#310)
    ├── mail.ts                           — SMTP gönderici; yapılandırma yoksa ÇÖKMEZ (#241)
    ├── auth/verification-token.ts        — e-posta doğrulama, durumsuz HMAC (#247)
    └── auth/reset-token.ts               — şifre sıfırlama, durumsuz HMAC (#262)
```

## Veritabanı Modelleri (özet)

| Model | Not |
|---|---|
| `User` | rol (ADMIN/MENTOR/STUDENT) + **accountStatus** (PENDING/APPROVED/REJECTED, #38) |
| `StudentProfile` | goals = **compiled** tek string (compiledGoals ile 3 alana ayrışır). **Mentör artık M:N** (#195) — `mentorId` FK KALDIRILDI |
| `MentorAssignment` | **#195** — Öğrenci↔Mentör M:N join tablosu; `@@unique([studentProfileId, mentorId])`. Mentorlar **eşit yetkili** (birincil yok). Yetki: `mentorAssignments: { some: { mentorId } }` / `isAssignedMentor()` (`lib/auth/mentor-access.ts`) |
| `ProjectTemplate` | **title @unique** (#112); githubRepoUrl (#49) |
| `AssignedProject` | `@@unique([studentProfileId, projectTemplateId])` (#58) |
| `Roadmap` / `RoadmapStep` | DRAFT/PUBLISHED; step'te githubIssueUrl (#50); öğrenci DRAFT'a etkileşemez (#52) |
| `SurveyQuestion` / `SurveyAnswer` | admin anket havuzu + stajyer cevapları (#45/#46) |
| `ProfileAnalysis` | AI profil analizinin kalıcı hali, profile 1-1 (#47) |
| `Suggestion` | Stajyer→admin öneri/istek; type + status + adminNote (#147) |
| `MentorProfile` / `MentorAnalysis` | mentör başvuru profili + AI eşleştirme analizi (#287/#288) |
| `StepIssue` | adım ↔ GitHub issue eşlemesi (#218) |
| `ProcessedWebhook` / `PullRequestReview` | webhook teslimat kimliği (#326) / PR'a inceleme yazıldığının otoriter kaydı (#327) |
| `Message` / `StepComment` / `StepFile` | mesajlaşma, yorum, dosya (`SecurityAnswer` #264'te düşürüldü) |

## Kritik Mimari Notlar

### Auth & Onay Akışı
1. Login: `authorize()` → IP+email rate-limit (yalnız başarısız denemeler sayılır) + dummy-hash timing koruması.
2. JWT callback **her istekte** rol + accountStatus'u DB'den tazeler → admin değişikliği aktif oturuma hemen yansır (#44).
3. `requireAuth`: rol kontrolü + APPROVED olmayan STUDENT'a 403.
4. Middleware: onaysız stajyeri `/account-status`'a yönlendirir; `/forgot-password` public.

#### ⚠️ Oturum çerezi adını ELLE VERMEYİN (#308 — canlıyı kırdı)
`authOptions.cookies.sessionToken.name` sabitlenmişti; `middleware.ts` ise oturumu
`getToken()` ile okuyor ve NextAuth v4 çerez adını `NEXTAUTH_URL`'e bakarak seçiyor
(https ⇒ `__Secure-` önekli). Sonuç: **HTTPS'te giriş yapan herkes /signin'e geri
atılıyordu**, lokalde (http) hiç görünmüyordu. Adı NextAuth'a bırakın — regresyon
testi `nextauth.test.ts`'te.

#### ⚠️ E-posta doğrulaması ONAYIN ön koşuludur (#310)
`emailVerified` artık dekoratif değil: `updateAccountStatus` bir hesabı **APPROVED**
yapmadan önce doğrulanmış olmasını şart koşar. Kapı bilerek **yalnız APPROVED'da** —
`PENDING`/`REJECTED`'a dönüş serbest (admin hatalı onayı geri alabilmeli). Girişe
kapı KONMADI: SMTP sessizce çökebildiği için (`mail.ts` hata fırlatmaz) herkesi
kilitleme riski var. `create:admin` ve `seed` doğrulanmış hesap üretir.

#### ⚠️ Rate-limit IP'si sağdan okunur (#308)
`X-Forwarded-For`'un **en solu istemcinin uydurduğudur** (vekil ekleme yapar, silme
değil). `lib/client-ip.ts` sağdan `TRUSTED_PROXY_HOPS` kadar sayar. Bu dosyayı
atlayıp doğrudan başlık okumayın — limitler atlatılabilir hale gelir.

#### ⚠️ PENDING profil-tamamlama sözleşmesi (#143 — bozmayın)
Stajyer **PENDING iken profilini tamamlar**; onay bu adımdan *sonra* gelir. Bu yüzden
profil-tamamlama yolları, "onaysız STUDENT'ı engelle" kuralının **bilinçli istisnasıdır**:
- `requireAuth(role, { allowUnapprovedStudent: true })` → PENDING geçer, **REJECTED yine 403**.
  Yalnızca profil-tamamlama uçlarında kullanılır (ör. `api/student/survey-answers`).
- `saveOnboarding` bilerek `requireAuth` **kullanmaz**; doğrudan `getServerSession` ile yalnız
  oturum kontrol eder (requireAuth'a çevirmek akışı kırar — dosyada açıklayıcı yorum var).
- Middleware: PENDING → yalnız `/profile-setup` + `/student-onboarding`; `/student-dashboard`
  engelli. REJECTED → tüm student alanı engelli.

"Güvenlik sıkılaştırması" niyetiyle bu uçlara `requireAuth` eklemeden önce buranın istisna
olduğunu hatırlayın; aksi halde onboarding tamamen çöker.

### AI Entegrasyonu
- `gcp-credentials.json` (gitignore'da) + `GOOGLE_CLOUD_PROJECT` env gerekir; yoksa
  analiz/özet fonksiyonları **mock'a düşer** (graceful degradation), chat hata döner.
- Profil analizi üretilince `ProfileAnalysis`'e upsert edilir; admin/mentor UI oradan okur (#47/#48).
- Öğrenci dashboard özeti `unstable_cache` 24s TTL + `revalidateTag`.

### Dosya Yükleme (`/api/steps/[stepId]/files`)
- Uzantı whitelist + **magic-byte içerik doğrulaması** (#113) + 10MB/10 dosya limiti.
- Erişim: öğrenci(sahip) veya mentoru; öğrenci yalnızca PUBLISHED roadmap'e yükler.
- **Depolama soyutlaması** `lib/storage/step-files.ts` (#197): `GCS_BUCKET` env varsa
  **GCS**, yoksa **yerel disk** (graceful degradation). İndirme signed URL değil **proxy**
  (route dosyayı okuyup akıtır) → per-request yetki kontrolü korunur. Detay: `DEPLOYMENT.md`.

### Process-local durumlar (tek instance varsayımı)
`metrics.ts` süreç-yereldir (yalnız teşhis sayaçları, güvenlik etkisi yok).

**`rate-limit.ts` artık DEĞİL (#322):** sayaçlar `RateLimit` tablosunda ve artırma
tek atomik SQL ifadesiyle yapılıyor — çok instance güvenli, Redis gerekmiyor.
Arayüz **asenkron**: `check`/`peek`/`reset` Promise döner. DB'ye ulaşılamazsa
**fail-open** (istek geçer + loglanır); kesintide tüm girişleri kilitlememek için
bilinçli karar.

### AI Kod İncelemesi (#327)
PR açıldığında (`opened` / `ready_for_review`) webhook Gemini'den ön inceleme alıp PR'a
**tek bir yorum** yazar. Akış: `pr-inceleme.ts` → `pr-diff.ts` (filtre+bütçe) →
`ai/server/code-review.ts` (prompt+Zod).

- **Mock fallback YOK** — bilinçli ve diğer AI modüllerinden farklı. Çıktı public bir PR'a
  yazılıyor; model çuvallarsa doğru davranış susmak.
- **İki katmanlı idempotens.** Ucuz katman: PR yorumlarında `<!-- aisigner-ai-review -->`
  aranır. Otoriter katman: `PullRequestReview` tablosu (`@@unique([repoUrl, prNumber])`),
  yorumdan hemen önce yazılır. ⚠️ İkincisi CANLI TESTTE bulundu: **GitHub'ın liste uçları
  anında tutarlı değil** — aynı hata `issueHazirla`'da kopya issue açtırdı (#345).
- **Maliyet kapıları** (`pr-inceleme.ts` başındaki sırayla): rıza → mevcut yorum → günlük
  tavan (öğrenci 10, platform 200) → diff (≤30 dosya, ≤40k karakter, lockfile/build elenir)
  → Gemini.

#### ⚠️ Rıza sürümü ve `guncelRizaVar` (#327)
Kod incelemesi öğrencinin **kodunu** da yurt dışına gönderiyor; bu yeni bir veri türü ve
yeni bir amaç, yani eski rıza metnini AŞIYOR. `RIZA_METIN_SURUMU` → `2026-09-v1`.
- `aiRizasiVar` **sürüme bakmaz** — mevcut özellikler (sohbet, analiz) eski rızayla çalışır.
  Her metin düzeltmesinde herkesin AI'ı kapansaydı platform sürekli işlevsiz kalırdı.
- `guncelRizaVar` **yürürlükteki sürümü şart koşar** — yalnızca KAPSAMI genişleyen
  özellikler kullanır. Bugün tek kullanıcısı kod incelemesi.
- Metnin kapsamını genişleten her değişiklikte sürüm artırılmalı ve ilgili özellik
  `guncelRizaVar`'a geçirilmeli.

### Mezuniyet & Sertifika Doğrulama Sistemi (#208)
- **Mezuniyet Durumu (`accountStatus: GRADUATED`)**: Portfolyo salt-okunur (Seçenek A). Öğrenci dashboard, yol haritası adımları, dosyaları, yorumları ve sertifikasını görüntüleyebilir; ancak adım durumu değiştirme, dosya yükleme/silme ve yorum ekleme/düzenleme/silme API'leri 403 ile engellenir.
- **Sertifika Doğrulama**: `/verify-certificate/[certificateNumber]` public doğrulama sayfası (`middleware.ts` `publicPaths` içinde). QR kod veya link üzerinden herkes sertifikanın geçerliliğini teyit edebilir.
- **Sertifika Notu (`completionGrade`)**: Varsayılan "Üstün Başarı" kaldırıldı (nullable). Admin mezun ederken veya sertifika düzenlerken açıkça seçer (`Üstün Başarı`, `Onur Derecesi`, `Yüksek Başarı`, `Başarılı` veya boş/belirlenmedi).
- **Stajyer Sertifika Erişimi**: Yalnızca `GRADUATED` durumundaki veya sertifikası düzenlenmiş (`issuedAt !== null`) öğrenciler sertifikalarını görüntüleyebilir (aktif öğrencilere 403).
- **⚠️ Sertifika persist sözleşmesi (bozmayın)**: Bir belge ancak `certificateNumber` **ve** `issuedAt`
  DB'de kayıtlıysa **resmidir** (`CertificateData.isIssued`). Mezuniyet (`updateAccountStatus →
  GRADUATED`) `ensureCertificateIssued()` ile bunları **kalıcı yazar**; öğrenci ucu eski kayıtlar
  için kendi kendini onarır. Aksi halde öğrenciye/QR'a **kayıtlı olmayan** bir seri no gösterilir
  ve `/verify-certificate` "bulunamadı" der — doğrulama özelliğinin değeri kaybolur.
- **Public verify rate-limit**: `/verify-certificate` IP başına 60 sn'de 20 sorgu (seri no
  enumeration koruması). `generateMetadata` + sayfa React `cache` ile **tek DB sorgusu** paylaşır.
- **Mezun yazma yetkisi — bilinçli kararlar (#208)**:
  - **Kapalı**: adım durumu, dosya yükleme/silme, yorum ekleme/düzenleme/silme, **AI chat**
    (her mesaj Gemini maliyeti + aktif staja bağlı araç) → 403.
  - **Açık (bilinçli)**: **öneri/istek (suggestions)** ve **mesajlaşma (`POST /api/messages`)** —
    ikisi de *insan iletişimi* kanalıdır; mezunun mentörüne/admin'e yazabilmesi meşru ve düşük
    riskli. Ürün daraltmak isterse ilgili POST uçlarına GRADUATED kontrolü eklenmeli.
  - **Ayrım ilkesi**: *sistem durumunu değiştiren* (adım/dosya/yorum) ve *ücretli AI* uçları
    kapalı; *insan iletişimi* açık.
- **⚠️ Sertifika yayınlama tek noktadan**: Belgeyi resmileştiren tek yer **mezuniyettir**
  (`ensureCertificateIssued`). Admin'in not/derece kaydetmesi (`updateCertificateDetails`)
  `issuedAt` **yazmaz** — aksi halde mezun olmayan öğrencinin belgesi public doğrulamada
  geçerli görünürdü. `certificateNumber` **@unique**; çakışmada seri no yeniden üretilir.
- **Public verify PII/enumeration**: rate-limit kontrolü `getVerification` **içinde** —
  Next.js `generateMetadata`'yı sayfadan önce çalıştırdığı için limit yalnız gövdede olsaydı
  `<title>` üzerinden ad + seri no sızardı. Tüm metadata `robots: noindex` (PII sayfası).

## Komutlar

```bash
npm run dev / build / lint / test
npm run seed          # idempotent demo verisi (kullanıcılar + şablonlar)
npm run test:ai       # Vertex AI bağlantı testi (.env gerekli)
npm run check:migrations   # yıkıcı migration guard (#198, CI'da zorunlu)
npm run create:admin       # ilk yöneticiyi env'den güvenle oluşturur (#206)
npm run typecheck          # tsc --noEmit (CI'da zorunlu, #160)
npx prisma migrate dev --name <ad>   # yeni şema değişikliği (db push kullanmayın)
docker compose up -d  # db (+app) — uploads kalıcı volume'da
```

> **Migration güvenliği (#198):** kolon/tablo silme, rename, NOT NULL gibi **yıkıcı**
> değişiklikleri tek deploy'da yapmayın — **expand/contract** ile bölün. Kural + guard +
> onay mekanizması: `docs/MIGRATIONS.md`. CI, onaysız yıkıcı migration'ı FAIL eder.

## Tasarım Sistemi

- slate nötr, blue-600/indigo-600 primary, emerald başarı, amber uyarı, red hata
- Kart: `bg-white rounded-2xl border border-slate-200/80 shadow-sm`; gradient header `from-blue-500 via-indigo-500 to-purple-500`
- Hata/boş durum ayrımı: sayfalarda `loadError` state + retry (sessizce boş liste gösterilmez)
- Toast: `sonner` (alert() kullanılmaz)

---

## Dağıtım (özet — detay `DEPLOYMENT.md`)

- Docker imajı **standalone** çıktı kullanır; runner'da `npm install` YOK. Prisma CLI
  migration için imaja ayrıca kopyalanır, entrypoint `node server.js` ile başlar (#10).
- `AUTH_SECRET` tek sırdır — **`NEXTAUTH_SECRET` diye bir değişken YOKTUR**. Oturum,
  e-posta doğrulama ve şifre sıfırlama token'larının üçü de bununla imzalanır;
  rotasyonu tüm oturumları ve bekleyen bağlantıları geçersiz kılar.
- `TRUSTED_PROXY_HOPS` platformun vekil sayısıyla uyuşmalı, yoksa rate-limit atlatılır.
- Üretim CSP'sinde `'unsafe-eval'` yoktur (`lib/security-headers.ts`); `'unsafe-inline'`
  Next hydration için bilerek durur — kaldırmak nonce + zorunlu dinamik render demek.
- Yedekleme/rollback prosedürü: `DEPLOYMENT.md §8`. Yıkıcı migration rollback'i imkânsız
  kılar → expand/contract (`docs/MIGRATIONS.md`).

---

*Son güncelleme: Ağustos 2026 — #308/#310 canlıya çıkış hazırlığı: oturum çerezi
bloker'ı, güvenilir istemci IP'si, e-posta doğrulamasının onaya bağlanması, üretim
CSP'si, standalone Docker imajı ve yedekleme/rollback prosedürü*


