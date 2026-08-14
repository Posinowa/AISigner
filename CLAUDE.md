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
│   ├── (auth)/signin|signup|forgot-password|signout/
│   ├── (mentor)/mentor-dashboard/        — öğrenci detay + roadmap yönetimi
│   ├── (student)/student-dashboard|profile-setup|student-onboarding/
│   ├── account-status/                   — PENDING/REJECTED stajyer ekranı (#39)
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
    ├── rate-limit.ts (peek/check/reset) · logger.ts · metrics.ts · experience-level.ts
    ├── file-signature.ts                 — upload magic-byte doğrulaması (#113)
    └── api-error-message.ts              — string/fieldErrors → tek mesaj (#114)
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
| `Message` / `StepComment` / `StepFile` / `SecurityAnswer` | mesajlaşma, yorum, dosya, güvenlik soruları |

## Kritik Mimari Notlar

### Auth & Onay Akışı
1. Login: `authorize()` → IP+email rate-limit (yalnız başarısız denemeler sayılır) + dummy-hash timing koruması.
2. JWT callback **her istekte** rol + accountStatus'u DB'den tazeler → admin değişikliği aktif oturuma hemen yansır (#44).
3. `requireAuth`: rol kontrolü + APPROVED olmayan STUDENT'a 403.
4. Middleware: onaysız stajyeri `/account-status`'a yönlendirir; `/forgot-password` public.

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
`rate-limit.ts`, forgot-password `resetTokens`, `metrics.ts` — çok-instance/serverless'ta
Redis gerekir → `DEPLOYMENT.md`.

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
  - **Açık (bilinçli)**: **öneri/istek (suggestions)** — mezun geri bildirimi meşru ve düşük riskli.
    Ürün bunu daraltmak isterse `api/suggestions` POST'una GRADUATED kontrolü eklenmeli.

## Komutlar

```bash
npm run dev / build / lint / test
npm run seed          # idempotent demo verisi (kullanıcılar + şablonlar)
npm run test:ai       # Vertex AI bağlantı testi (.env gerekli)
npm run check:migrations   # yıkıcı migration guard (#198, CI'da zorunlu)
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

*Son güncelleme: Ağustos 2026 — #208 Mezuniyet sertifikası, doğrulama sayfası ve salt-okunur mezun portfolyo erişimi*


