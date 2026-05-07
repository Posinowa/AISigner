# AISigner — Proje Hafızası (CLAUDE.md)

Bu dosya Claude'un AISigner projesini hızla anlaması için oluşturulmuştur.
Her oturumda bu dosyayı okuyarak kaynak dosyaları baştan taramak gerekmez.

---

## Projeye Genel Bakış

**AISigner** — Mentör-öğrenci eşleştirme ve yapay zeka destekli staj/proje yönetim platformu.

- **Stack**: Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, shadcn/ui
- **Auth**: NextAuth v4, JWT strateji, Credentials provider, argon2 hash
- **DB**: PostgreSQL + Prisma ORM v6 (schema: `prisma/schema.prisma`)
- **AI**: Google Vertex AI / Gemini 2.0 Flash (`@google-cloud/vertexai`)
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

### 🔴 Kritik — Henüz Düzeltilmedi

| # | Sorun | Dosya | Açıklama |
|---|---|---|---|
| S3 | Dosya yükleme disk'e yazıyor | `api/steps/[stepId]/files/route.ts` | `process.cwd()/uploads/` deploy'da sıfırlanır. GCS/S3 entegrasyonu gerekiyor |
| S4 | Rate limiter process-local | `lib/rate-limit.ts` | Multi-instance/serverless'ta işlevsiz. Redis gerekiyor |

### ✅ Kritik — Düzeltildi

| # | Sorun | Dosya | Düzeltme |
|---|---|---|---|
| S1 | Şifre sıfırlama token eksikliği | `api/auth/forgot-password/verify/route.ts` | `resetTokens` Map + `crypto.randomBytes(32)` token + 5dk TTL eklendi |
| S2 | Admin öz-rol değişikliği | `api/admin/users/route.ts` | `userId === session.user.id` guard, 403 döner |

### 🟡 Orta Önem — Henüz Düzeltilmedi

| # | Sorun | Dosya | Açıklama |
|---|---|---|---|
| M2 | Onboarding şema uyumsuzluğu | `features/student/models/onboarding.ts` | `personalSchema`'daki `phoneNumber` DB'ye kaydedilmiyor, `firstName/lastName` da User'a yazılmıyor |
| M4 | Roadmap overwrite koruması yok | `api/mentor/generate-roadmap/route.ts` | Mevcut roadmap üzerine yenisi yazılabilir, öğrenci ilerlemesi silinebilir |
| M6 | ADMIN mesajlaşma erişimi yok | `api/messages/route.ts` | requireAuth(["MENTOR","STUDENT"]) — ADMIN mesaj gönderemiyor |

### ✅ Orta Önem — Düzeltildi

| # | Sorun | Düzeltme |
|---|---|---|
| M1 | Student dashboard her yüklemede AI çağrısı | `unstable_cache` 24saat TTL + `revalidateTag` onboarding'de |
| M3 | signinSchema min(6) vs signupSchema min(8) | `passwordSchema` export edildi, her iki şema da kullanıyor |
| M5 | Mentor dashboard `useEffect` + fetch | `useCallback` + proper deps ile düzeltildi |

### 🟢 Düşük Önem

| # | Sorun | Açıklama |
|---|---|---|
| ~~L1~~ | ~~ESLint 25 hata~~ | ✅ Düzeltildi: `as any` → tip-güvenli cast, `useCallback` ile exhaustive-deps, `&apos;` escape |
| L2 | AI chat getModel() vs getVertexAI() | `ai-chat/route.ts` `responseMimeType` olmadan farklı model init kullanıyor |
| L3 | alert() çağrıları | Birçok sayfada `alert()` — toast/snackbar ile değiştirilmeli |
| L4 | N+1 query riski | `getMentorStudents` her öğrenci için ayrı query değil ama assignedProjects include zinciri dikkat gerektiriyor |

---

## Önemli Mimari Notlar

### Auth Akışı
1. Kullanıcı giriş → `signin/actions.ts:validateUser()` → NextAuth `signIn("credentials")` → JWT token
2. JWT token cookie'de: `next-auth.session-token` (httpOnly, sameSite:lax)
3. Middleware: `src/middleware.ts` — route grupları → rol kontrolü
4. API guard: `lib/auth/guard.ts:requireAuth()` — her API route'ta kullanılıyor

### AI Entegrasyonu
- Singleton: `lib/ai/gemini-client.ts:getVertexAI()` — proses başına bir kez init
- `getModel()` → `responseMimeType: "application/json"` ile JSON döndürür
- **Dikkat**: `ai-chat/route.ts` `getVertexAI()` kullanıyor, `getModel()` değil — JSON MIME type yok
- Credentials: `gcp-credentials.json` (repo'ya eklenmemeli), `GOOGLE_CLOUD_PROJECT` env gerekli

### Şifre Sıfırlama Akışı (3 adım, tek endpoint)
```
POST /api/auth/forgot-password/verify
  { email }                              → step: "questions" (güvenlik soruları döner)
  { email, answers[] }                   → step: "verified" + resetToken (5dk TTL, tek kullanımlık)
  { email, resetToken, newPassword }     → step: "success" (token doğrulama + şifre güncelleme)
```
⚠️ Frontend'in de bu akışı desteklemesi gerekiyor: step 2 yanıtındaki `resetToken`'ı step 3'e göndermeli.

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
