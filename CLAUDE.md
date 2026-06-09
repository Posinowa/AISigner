# AISigner — Proje Hafızası (CLAUDE.md)

Bu dosya Claude'un AISigner projesini hızla anlaması için oluşturulmuştur.
Her oturumda bu dosyayı okuyarak kaynak dosyaları baştan taramak gerekmez.

---

## Projeye Genel Bakış

**AISigner** — Mentör-öğrenci eşleştirme ve yapay zeka destekli staj/proje yönetim platformu.

- **Stack**: Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, shadcn/ui
- **Auth**: NextAuth v4, JWT strateji, Credentials provider, argon2 hash
- **DB**: PostgreSQL + Prisma ORM v6 (schema: `prisma/schema.prisma`)
- **AI**: Google Vertex AI / Gemini 2.5 Flash (`@google-cloud/vertexai`). Bağlantı testi: `npm run test:ai`
- **Validation**: Zod v4
- **Form**: react-hook-form v7

---

## Klasör Yapısı

```
src/
├── app/
│   ├── (admin)/admin-dashboard/          — Admin paneli (kullanıcı/rol/mentor atama)
│   ├── (auth)/signin|signup|forgot-password/  — Auth sayfaları
│   ├── (mentor)/mentor-dashboard/        — Mentor paneli + öğrenci detay + roadmap
│   ├── (student)/student-dashboard|profile-setup|student-onboarding/
│   ├── api/
│   │   ├── admin/users|project-templates|mentors/
│   │   ├── auth/forgot-password/verify/  — 3 adımlı şifre sıfırlama
│   │   ├── mentor/students|assign-project|unassign-project|ai-recommend-projects|generate-roadmap|roadmap/
│   │   ├── student/ai-chat|steps/
│   │   ├── steps/[stepId]/comments|files/
│   │   └── messages/conversations|unread-count/
│   └── layout.tsx
├── components/
│   ├── LogoutButton.tsx
│   ├── SessionProvider.tsx
│   └── ui/button|input|progress.tsx      — shadcn bileşenleri
├── features/
│   ├── admin/server/user.ts              — getAllUsers, updateUserRole, assignMentor
│   ├── ai/server/
│   │   ├── generate-roadmap.ts           — generateRoadmap(studentProfile, projectTemplate)
│   │   ├── profile-analysis.ts           — analyzeStudentProfile(input) → ProfileAnalysisResult
│   │   └── project-recommendations.ts   — recommendProjects(profile, templates) → RankedProject[]
│   ├── ai/ui/AIChatBot.tsx               — Öğrenci AI sohbet botu (Posilog)
│   ├── auth/
│   │   ├── models/user.ts                — signupSchema, signinSchema (Zod)
│   │   └── ui/SecurityQuestionsSetup.tsx
│   ├── files/ui/StepFiles.tsx
│   ├── mentors/server/actions.ts         — getMentorStudents, getStudentDetail, assignProjectToStudent...
│   ├── messaging/ui/MessagingPanel|StepComments|UnreadBadge.tsx
│   ├── projects/server/templates.ts
│   └── student/
│       ├── models/onboarding.ts          — personalSchema, experienceSchema, goalsSchema
│       ├── server/onboarding.ts          — saveOnboarding() server action
│       ├── server/profileSummary.ts      — getProfileSummary() → AI çağrısı yapar
│       └── ui/OnboardingForm|ProfileSummaryCard|RoadmapSteps.tsx
└── lib/
    ├── ai/gemini-client.ts               — getVertexAI(), getModel()
    ├── auth/
    │   ├── guard.ts                      — requireAuth(role|role[]) API guard
    │   ├── nextauth.ts                   — authOptions (JWT + Credentials)
    │   └── prisma.ts                     — Prisma singleton (globalThis pattern)
    ├── db.ts                             — Prisma singleton (aynı ama lib/db'de de var)
    ├── rate-limit.ts                     — createRateLimiter() in-memory Map
    ├── security-questions.ts             — SECURITY_QUESTIONS dizisi
    └── validations/api.ts                — updateRoleSchema, assignMentorSchema
```

---

## Veritabanı Modelleri (Özet)

| Model | Açıklama |
|---|---|
| `User` | ADMIN / MENTOR / STUDENT, argon2 hash'li şifre |
| `Session` | NextAuth JWT session |
| `StudentProfile` | Öğrenci profili, mentorId FK, assignedProjects |
| `ProjectTemplate` | EASY/MEDIUM/HARD, track[], assignedProjects |
| `AssignedProject` | PENDING/IN_PROGRESS/COMPLETED, 1-to-1 Roadmap |
| `Roadmap` | DRAFT/PUBLISHED, steps[] |
| `RoadmapStep` | TODO/IN_PROGRESS/COMPLETED, resources[], comments[], files[] |
| `Message` | sender↔receiver, isRead, VarChar(2000) |
| `StepComment` | stepId, authorId, VarChar(1000) |
| `SecurityAnswer` | userId, questionId, argon2 hash'li cevap |
| `StepFile` | storedName @unique, disk'e yazılıyor (process.cwd()/uploads/steps/) |

---

## Kritik Bilinen Sorunlar ve Düzeltme Durumu

### ✅ Düzeltildi

| # | Sorun | Dosya | Düzeltme |
|---|---|---|---|
| 1 | `phone: z.string().min(10)` — opsiyonel alana zorunlu validasyon | `features/auth/models/user.ts` | `z.string().optional()` yapıldı |
| 2 | `signupAction` any tipli prevState/return | `app/(auth)/signup/actions.ts` | `SignupState` union tipi eklendi |
| 3 | Phone alanı boş string olarak DB'ye yazılıyordu | `app/(auth)/signup/actions.ts` | `phoneRaw?.trim() \|\| undefined` + `parsed.data.phone ?? null` |
| 4 | AI Öner butonu `projectTemplates.length === 0` yüzünden hep disabled | `app/(mentor)/mentor-dashboard/[studentId]/page.tsx` | `templatesLoading` state eklendi |
| 5 | Signin `err: any` ESLint hatası | `app/(auth)/signin/page.tsx` | `unknown` + `instanceof Error` guard |
| 6 | Signup sayfası isPending yoktu | `app/(auth)/signup/page.tsx` | useActionState'in isPending kullanılıyor |

### 🟠 Kritik — Deploy-bağımlı (tek-instance'ta çözüldü, ölçeklemede dikkat)

| # | Sorun | Dosya | Durum |
|---|---|---|---|
| S3 | Dosya yükleme yerel disk'e yazıyor | `api/steps/[stepId]/files/route.ts` | Tek-instance: `uploads_data` volume ile kalıcı (`docker-compose.yml`). Çok-instance: GCS/S3 → `DEPLOYMENT.md` |
| S4 | Rate limiter + resetTokens process-local | `lib/rate-limit.ts`, `forgot-password/verify` | Tek-instance: çalışır. Çok-instance/serverless: Redis → `DEPLOYMENT.md` |

### ✅ Kritik — Düzeltildi

| # | Sorun | Dosya | Düzeltme |
|---|---|---|---|
| S1 | Şifre sıfırlama token eksikliği | `api/auth/forgot-password/verify/route.ts` | `resetTokens` Map + `crypto.randomBytes(32)` token + 5dk TTL |
| S2 | Admin öz-rol değişikliği | `api/admin/users/route.ts` | `userId === session.user.id` guard, 403 |
| G1 | Login'de brute-force koruması yoktu | `lib/auth/nextauth.ts` | `authorize`'a IP+email rate-limit (`peek`/`check`/`reset`); yalnızca başarısız denemeler sayılır |
| G3 | Kullanıcı enumerasyonu (timing) | `lib/auth/nextauth.ts` | Kullanıcı yoksa dummy argon2 `verify` → sabit zamanlı yanıt |
| G4 | CSP header yoktu | `next.config.ts` | Content-Security-Policy eklendi (Next.js uyumlu) |

### ✅ Orta Önem — Düzeltildi

| # | Sorun | Düzeltme |
|---|---|---|
| M1 | Student dashboard her yüklemede AI çağrısı | `unstable_cache` 24s TTL + `revalidateTag` |
| M2 | Onboarding şema-DB uyumsuzluğu | `saveOnboarding` artık firstName/lastName→`User`, phoneNumber→`User.phone` yazıyor (`$transaction`) |
| M3 | signinSchema min(6) vs signupSchema min(8) | `passwordSchema` export, ikisi de kullanıyor |
| M4 | Roadmap overwrite koruması | `generate-roadmap` mevcut roadmap varsa 400 + mentor ownership kontrolü |
| M5 | Mentor dashboard `useEffect`+fetch | `useCallback` + doğru deps |
| M6 | ADMIN mesajlaşma erişimi | `messages/route` artık `["MENTOR","STUDENT","ADMIN"]` + `verifyConversationAccess` ADMIN dalı |

### 🟢 Düşük Önem

| # | Sorun | Durum |
|---|---|---|
| ~~L1~~ | ~~ESLint hataları~~ | ✅ `any` sıfır; kalan `no-unescaped-entities` + `seed.ts any` temizlendi → `next build` lint'siz bayrak OLMADAN geçer |
| ~~L2~~ | ~~AI chat getModel vs getVertexAI~~ | ✅ `getTextModel()` (düz metin) + `getModel()` (JSON) ayrıldı; chat `getTextModel` kullanıyor |
| ~~L3~~ | ~~alert() çağrıları~~ | ✅ Tümü `sonner` toast'a taşındı (kodda `alert(` yok) |
| L4 | N+1 query riski | `getMentorStudents` tek sorgu (include zinciri) — sorun gözlenmedi, düşük |

### ✨ Haziran 2026 oturumu — Tasarım / Güvenlik / Kalite taraması

**Güvenlik:** G1/G3/G4 (yukarıda). `DEPLOYMENT.md` ile ölçekleme yol haritası (Redis/GCS).

**Tasarım / UX (a11y):**
- Tüm auth + onboarding formlarında `htmlFor`/`id` eşleşmesi + şifre toggle `aria-label`.
- shadcn tema tokenları `globals.css` `@theme` ile tanımlandı → `ui/button` & `ui/input` artık çalışıyor; ölü `tailwind.config.ts` v4 stub'una indirildi (tokenlar artık `@theme`'de).
- `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` boundary'leri eklendi; mentor dashboard'a error+retry state'i.

**Kod kalitesi:**
- `mentors/server/actions.ts` DB hatasını artık yutmuyor (rethrow) → API 500 döner, UI error state'i tetiklenir.
- `lib/logger.ts` (seviyeli, ortam-farkında) eklendi; `mentors/actions.ts` ona geçirildi.
- `vitest` + `lib/rate-limit.test.ts` (7 test) → `npm test`.

**Açık notlar:** Ölü kod `getAvailableProjects` kaldırıldı. `npm audit` zafiyetleri transitive bağımlılıklardan (çoğu dev araç zinciri); kırıcı major bump riski nedeniyle `--force` uygulanmadı.

---

## Önemli Mimari Notlar

### Auth Akışı
1. Kullanıcı giriş → `signin/actions.ts:validateUser()` → NextAuth `signIn("credentials")` → JWT token
2. JWT token cookie'de: `next-auth.session-token` (httpOnly, sameSite:lax)
3. Middleware: `src/middleware.ts` — route grupları → rol kontrolü
4. API guard: `lib/auth/guard.ts:requireAuth()` — her API route'ta kullanılıyor

### AI Entegrasyonu
- Singleton: `lib/ai/gemini-client.ts:getVertexAI()` — proses başına bir kez init
- `getModel()` → JSON döndürür (`responseMimeType: "application/json"`); `getTextModel()` → düz metin (chat)
- `ai-chat/route.ts` `getTextModel()` kullanır (doğru). AI hata verirse `analyzeStudentProfile`/`getProfileSummary` mock'a düşer (graceful degradation)
- Credentials: `gcp-credentials.json` (repo'ya eklenmemeli, gitignore'da), `GOOGLE_CLOUD_PROJECT` env gerekli

### Şifre Sıfırlama Akışı (3 adım, tek endpoint)
```
POST /api/auth/forgot-password/verify
  { email }                              → step: "questions" (güvenlik soruları döner)
  { email, answers[] }                   → step: "verified" + resetToken (5dk TTL, tek kullanımlık)
  { email, resetToken, newPassword }     → step: "success" (token doğrulama + şifre güncelleme)
```
✅ Frontend (`forgot-password/page.tsx`) bu akışı destekliyor: step 3'te `resetToken` + `answers` birlikte gönderiliyor (token asıl yetki, answers ek kontrol).

### Dosya Yükleme
- `POST /api/steps/[stepId]/files` → `process.cwd()/uploads/steps/` (ephemeral disk)
- Max 10 dosya/adım, 10MB limit
- Extension whitelist: png/jpg/gif/webp/pdf/txt/md/csv/json/zip + kod dosyaları
- **Sorun**: Deploy'da disk sıfırlanır → GCS/S3 gerekiyor

### Rate Limiting
- `lib/rate-limit.ts` — in-memory Map, process-local
- signup: 5 req / 5dk; forgot-password: 5 req / 5dk (IP) + 10 req / 1saat (email); ai-chat: 20 req / 1dk; file-upload: 10 req / 1dk
- **Sorun**: Multi-instance veya serverless'ta her instance ayrı sayar → Redis gerekiyor

---

## Ortam Değişkenleri

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aisigner?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLOUD_PROJECT=<gcp-project-id>
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=gcp-credentials.json
```

---

## Geliştirme Komutları

```bash
npm run dev          # Dev server (localhost:3000)
npx prisma studio    # DB UI
npx prisma db push   # Schema → DB (migration olmadan)
npx prisma generate  # Client üret
npx tsx scripts/seed.ts  # Seed verisi
```

---

## Tasarım Sistemi

- Tailwind v4 utility classes
- Renk paleti: slate (nötr), blue-600/indigo-600 (primary), emerald (success), amber (warning), red (danger)
- Kart stili: `bg-white rounded-2xl border border-slate-200/80 shadow-sm`
- Gradient header: `from-blue-500 via-indigo-500 to-purple-500`
- Auth sayfaları: `bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100` + `rounded-3xl` kart + üst gradient şerit

---

*Son güncelleme: Mayıs 2026 — Alper ile oturum*
