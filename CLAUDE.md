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
│   ├── progress/                         — ilerleme + duraklama, TEK kaynak (#432)
│   ├── suggestions/                      — öneri/istek: labels + server (#147)
│   ├── survey/                           — answers + server/survey (#45/#46)
│   ├── roadmap/odak.ts                    — "hangi adımdayım" TEK kaynak (#416)
│   ├── roadmap/gruplama.ts                — tamamlananları katlama (#417)
│   ├── roadmap/taslak.ts                  — taslak uyarı metinleri (#405)
│   ├── roadmap/server/siralama.ts         — adım sırası, 1..n yeniden yazar (#406)
│   ├── roadmap/server/gecmis.ts           — geçmiş adım başlıkları (#423)
│   ├── kvkk/kod-incelemesi-durumu.ts      — rıza engelinin sebebi (#394)
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
| `WorkspaceRequest` | mentörün çalışma alanı talebi, admin onayı (#349); `pendingKey @unique` bekleyen tekilliği |
| `ProcessedWebhook` / `PullRequestReview` | webhook teslimat kimliği (#326) / PR'a inceleme yazıldığının otoriter kaydı (#327) |
| `ProjectProposal` | stajyerin kendi proje önerisi (#366); `pendingKey @unique` bekleyen tekilliği, `kaynak`/`kararKaynak` GitHub tercihi |
| `OfisSaatiSlotu` | mentörün 1-e-1 görüşme dilimi (#398); `@@unique([mentorId, baslangic])` çift açmayı, koşullu UPDATE çift rezervasyonu engeller |
| `TypingSignal` | "yazıyor..." sinyali (#354); `@@id([fromUserId, toUserId])` — yazma satır biriktirmez, `expiresAt` ile kendiliğinden söner |
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

#### ⚠️ ROLÜN VARLIĞI ZORUNLU — rol istensin istenmesin (#391)
`nextauth.ts` silinmiş kullanıcıda `token.role = undefined` yapıyor (doğru), ama
`guard.ts` bunu iki yerden birden kaçırıyordu: rol kontrolü `if (requiredRole)` içindeydi
(rolsüz `requireAuth()` çağrılarında hiç çalışmıyordu) ve hesap durumu kapısı
`role === "STUDENT" || "MENTOR"` ile sınırlıydı (`undefined` olduğu için o da atlanıyordu).
**Silinen hesabın jetonu, süresi dolana kadar iş görmeye devam ediyordu.**

Artık `session.user.role` yoksa **401** — 403 değil: hesap YOK, istemci oturumu temizleyip
yeniden giriş yapmalı. `allowUnapprovedStudent` (#143) bu kapıyı **açmaz**.

#### ⚠️ API rotaları YÖNLENDİRİLMEZ, 401/403 JSON döner (#375)
`middleware.ts`'te `/api/` kontrolü dosyanın **sonunda** duruyordu ("guard.ts zaten
koruma sağlıyor") — niyet doğruydu ama oturumsuz kullanıcıyı `/signin`'e yollayan blok
ondan **önce** çalışıyordu. Sonuç: her API isteği **307 ile HTML login sayfasına**
gidiyordu; `fetch(...).json()` `SyntaxError` fırlatıyor, bileşenler bunu "veri
yüklenemedi" diye gösteriyordu — kullanıcı oturumunun düştüğünü öğrenemiyordu.

Kontrol artık yönlendirmelerden **önce**. Yeni bir yönlendirme eklerken bu sıra
korunmalı; sözleşmenin örtük kalması bu hatanın kök nedeniydi.

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

### Takım / Scrum Projeleri (#332)
2–4 kişilik takım ortak bir pano ve ortak bir repo paylaşır. **Sahiplik takımda, kredi kişide.**

- `AssignedProject` takıma ait (**tek kayıt → tek roadmap → tek repo**); `studentProfileId`
  nullable, `teamId` dolu. **Sahip TAM BİRİ olmalı** — kısıt ham CHECK olarak VERİTABANINDA
  (`assigned_project_sahip_tek`), Prisma ifade edemiyor.
- **Sertifika BİREYSEL kalıyor.** Katkı `RoadmapStep.assigneeId` (kim üstlendi) +
  `StepStatusHistory.changedById` (kim tamamladı, #324) üzerinden ölçülür.
- **`sahiplik.ts` tek doğru kaynak.** "Bu atama kimin" sorusunu 15 dosya soruyordu; hepsi
  `ATAMA_SAHIPLIK_SELECT` + saf yardımcılardan geçiyor. Fonksiyonlar veri ÇEKMİYOR.
- **Ayrılmış üye sahip DEĞİL** ama satırı SİLİNMİYOR (`leftAt`) — katkı geçmişi sertifikanın
  dayanağı. Ayrılınca üstlendiği adımlar panoya geri düşer.
- **Mentör TAKIMA atanır.** ⚠️ **TAKIM PANOSUNDA OKUMA VE YAZMA AYRI** (#434):
  - **Yazma** (`mentoruMu`): yalnız TAKIMIN mentörleri. Ortak panoya yazılan her
    şey (adım ekleme/silme, revizyon, çalışma alanı talebi, yol haritası üretimi)
    TÜM TAKIMI etkiliyor; 4 kişilik bir takımda her üyenin 2 kişisel mentörü
    varsa ortak panoya 8 kişi yazabilirdi.
  - **Okuma** (`erisebilirMi`): üyenin KİŞİSEL mentörü de girer
    (`uyeninKisiselMentoruMu`). Mentörün, öğrencisinin takımda yaptığı işe
    (yorumlar, teslim dosyaları, üstlenme) bakamaması savunulamaz.

  ⚠️ Bu ayrım bir HATADAN doğdu: docstring "üyelerin kişisel mentörleri de
  yetkili sayılıyor" diyordu ama kod bunu YAPMIYORDU — takım atamasında
  `studentProfile` NULL olduğu için (#332) ilgili dal hiç çalışmıyordu ve
  `erisebilirMi` de `mentoruMu`ya dayandığı için kişisel mentör panoyu
  OKUYAMIYORDU bile.

  ⚠️ `SahiplikliAtama` tipinde `members[].studentProfile.mentorAssignments`
  ZORUNLU: alanı `ATAMA_SAHIPLIK_SELECT`'ten çıkarmak DERLEME HATASI veriyor.
  Opsiyonelken hiçbir test yakalayamıyordu — testler nesneyi elle kuruyor,
  Prisma select'inden geçmiyor. Seçim ile kullanımı bağlayan şey tip.
- **Adım kilitlenmez:** başkasının üstlendiği adım devralınabilir (havuzdan iş çekme).
  Adım yalnızca ATAMANIN ÖĞRENCİLERİNE atanabilir — yoksa mentör panoya kendini yazardı.
- Takımda AI girdileri: seviye **EN DÜŞÜK** (pano ortak, en yeni üye de takip etmeli),
  PR incelemesinde **HERKESİN** rızası aranır (kimin hangi satırı yazdığı bilinmiyor),
  günlük tavan **takım başına**.
- ⚠️ **HAM SQL'DE SAHİPLİK `sahiplik-sql.ts`'TEN GELİR** (#376). Analitik ham SQL
  kullanıyor (toplama veritabanında olmalı, #313 dersi), yani kural İKİ DİLDE yaşamak
  zorunda. Kopyayı kaldıramıyoruz ama **tek dosyaya** hapsettik. Birini değiştiren
  diğerini de değiştirmeli: `mentorunOgrencisiWhere ↔ mentorunOgrencisiSql`,
  `mentorErisimiWhere ↔ mentorunAtamasiSql`. Bulunan hata: `JOIN "StudentProfile" sp ON
  sp.id = ap."studentProfileId"` takım atamasında `studentProfileId` NULL olduğu için
  **tüm takım projelerini** darboğaz analizinden eliyordu — panel sessizce eksik tablo
  gösteriyordu. SQL parça testleri yalnız METNİ kilitler; davranış **gerçek Postgres'e
  ekilmiş bilinen değerlerle** doğrulanmalı.
- ⚠️ **"BU ÖĞRENCİ BENİM Mİ?" TEK KAYNAKTAN SORULUR** (#370): `sahiplik.ts`
  `mentorunOgrencisiWhere()`. Bu kontrol kod tabanında **altı ayrı yerde** elle
  yazılmıştı ve #332 takım mentörlüğünü eklediğinde hepsi birden eksik kaldı — ama
  **hepsi aynı anda fark edilmedi**: #367 iki liste sorgusunu, #370 mesajlaşma
  yetkisini + konuşma listesini + öğrenci DETAY ucunu düzeltti. Detay ucu özellikle
  sinsiydi: #367 listeyi düzelttikten sonra **liste doluyor ama tıklanan bağlantı 404
  veriyordu**. Yeni bir "bu öğrenci benim mi" kontrolü yazmayın, buradan geçirin.
- ⚠️ **SAYAÇLAR DA İKİ YOLDAN SAYAR** (#393). Körlüğün dördüncü örneği ve ilki
  sorguda değil **sayımda**: mentör panosu yalnız `assignedProjects`'e bakıyordu, takımı
  olup bireysel projesi olmayan stajyer "0 aktif proje" sayılıyor ve mentöre yanlış
  "aktif projesi yok" uyarısı gidiyordu. Kural `mentors/proje-sayaci.ts`'te saf
  fonksiyonlarda — hata tam da **testsiz bir satırda** duruyordu.
  **Panel toplamı PROJE başına, öğrenci başına DEĞİL**: bir takım projesi üç üyenin de
  projesidir, öğrenci başına toplamak tek projeyi üç kez sayar. Öğrenci kartındaki sayı
  ise 1 kalır — o proje gerçekten onun.
- ⚠️ **ÜÇÜNCÜ YÜZEY: MENTÖRÜN ÖĞRENCİ DETAYI** (#442). Aynı hata sınıfı üç yerdeydi;
  #367 ikisini düzeltmişti (mentör listesi, öğrenci panosu), `getStudentDetail`
  atlanmıştı. **#370'ten daha sinsi**: orada mentör listede görüp detayda 404 alıyordu,
  burada sayfa AÇILIYOR ama iş görünmüyor — sessiz olduğu için kimse fark etmiyor.
  Canlı kanıt: `studentProfileId: NULL, teamId: t437_tm` olan atama için
  `assignedProjects: 0 kayıt`. Takım satırı bireyselmiş gibi durmuyor (takım adı +
  üyeler rozetli) ve takımda AI yol haritası üretimi kapalı olduğu için (#332) düğme
  yerine SEBEBİ yazılı — yoksa mentör basıp 400 alırdı.
- ⚠️ **Takımın öğrencileri İKİ YOLDAN gelir** (#367): liste sorguları hem bireysel
  `MentorAssignment` hem `TeamMentor`/`TeamMember` bağını sormalı. Aynı şekilde öğrenci
  panosu `studentProfile.assignedProjects` + `teamMemberships.team.assignedProjects`
  birleşimini göstermeli — takım atamasında `studentProfileId` NULL olduğu için tek başına
  ilk sorgu takım projesini HİÇ getirmez. İkisi de canlıda boş liste olarak görünmüştü.
- ⚠️ **Takım için AI yol haritası/adım üretimi YOK** — açık 400. Sentetik profil uydurmak
  üretilen içeriğin kime göre ayarlandığını belirsizleştirirdi.

### Kendi Projeni Öner (#366)
Stajyer hazır havuzdan seçmek yerine **kendi projesini önerir**; admin onaylayınca normal
bir atamaya dönüşür. `features/proposals/server/oneri.ts` tek doğru kaynak.

Üç GitHub kaynağı **tek akışta** (`kaynak`):
- **BIZIM** — onaydan sonra depoyu biz açarız (`NOT_PROVISIONED` → #349 akışı).
- **BAGLA** — depo stajyerde kalır, yalnız atamaya bağlanır.
- **DEVRET** — depo organizasyona geçer, tüm otomasyon çalışır.

- **⚠️ KAYNAK KARARI ADMİN'İN** (`kararKaynak`). Stajyer TERCİHİNİ belirtir; depo bağlamak
  da devir almak da organizasyonu ilgilendirdiği için son söz admin'de.
- **⚠️ DEVRİ PLATFORM BAŞLATAMAZ.** GitHub'ın transfer ucu yalnız depo sahibine açık.
  `devirTamamlandiMi` sadece **tespit eder** (org altında aynı adla `repos.get`). Onay,
  devir tamamlanmadan verilemiyor — aksi halde var olmayan bir depoya atama bağlanırdı.
- **⚠️ `githubStatus: "LINKED"` yeni bir durum: depo VAR ama BİZ KURMADIK.** Provisioning
  kilidi `notIn: ["PROVISIONING", "LINKED"]` — bu kapı olmasa kurulum **stajyerin kendi
  deposuna** milestone ve issue açardı. `talep.ts` `KURULU_DURUMLAR`'a da eklendi.
- **BAGLA'da webhook ve AI kod incelemesi ÇALIŞMAZ** (depo stajyerin hesabında,
  `GITHUB_TOKEN` orada yetkisiz). Bu bedel **arayüzde seçim anında yazılı** — sonradan
  öğrenilen kayıp özellik hata gibi görünür. #348 (GitHub App) çözer.
- **Öneriden türeyen şablon ORTAK HAVUZA GİRMEZ** (`ProjectTemplate.fromProposal`).
  Fikri öneren kişinin projesi başkalarına önerilirse habersiz dağıtılmış olur.
- **Bekleyen tekilliği `pendingKey`** ile (#345/#349 deseni): PENDING iken `studentProfileId`,
  karara bağlanınca NULL. Kısıt **veritabanında**, "önce sorgula sonra oluştur" değil.
- **Karar yarışında atama SİLİNİR.** Onay `updateMany` count 0 dönerse (başkası araya girdi)
  az önce oluşturulan `AssignedProject` geri alınır — yetim atama kalmaz.
- **Red gerekçesi zorunlu** ve stajyere gösterilir; yoksa aynı öneri tekrar açılır.

#### ⚠️ HER KULLANICI METNİ `veriBlogu` İLE SARILIR (#390)
#320 `guvenliMetin`/`guvenliListe`/`veriBlogu` korumasını kurmuştu ama yalnız **üç**
modüle uygulanmıştı. Tarama **altı korumasız prompt kurucusu** buldu:
`generate-roadmap`, `issue-generator`, `mentor-analysis`, `project-recommendations`,
`ai-chat`, `ai-step`.

- **En ciddisi `issue-generator`**: çıktısı **public bir GitHub deposuna** yazılıyor —
  `prompt.ts` bunu zaten uyarı olarak yazmıştı.
- **`prompt.ts`'in kendi açıklaması `motivation`/`mentoringStyle`'ı sayıyordu**, oysa
  `mentor-analysis` onları ham gömüyordu.
- **⚠️ PROJE ŞABLONU BAŞLIĞI/AÇIKLAMASI DA KULLANICI METNİ.** #366'dan beri stajyerin
  kendi önerisinden türeyen şablonlar var (`fromProposal`); "admin yazdı" varsayımı artık
  geçersiz.
- Yeni bir prompt kurucusu yazan `veriBlogu`'ndan geçirmeli. Çıktı doğrulaması
  (`cozVeDogrula`) **şekli** korur, **içeriği** değil: şemaya uyan ama saptırılmış bir
  yanıt doğrulamadan geçer.

#### ⚠️ HER AI ÇIKTISI `cozVeDogrula`'DAN GEÇER (#377)
İki uç bu katmanı atlıyordu: `issue-generator.ts` ham `JSON.parse`, `ai-step` elle
regex temizliği. Model — `responseMimeType` istense bile — çıktıyı ```json bloğuna
sarabiliyor ya da başına açıklama ekleyebiliyor; o durumda `JSON.parse` patlayıp akış
**sessizce mock içeriğe** düşüyordu. Mentör/öğrenci uydurma issue başlıklarıyla
çalışıyor ve bunu gerçek AI çıktısından **ayırt edemiyordu**.

- Elle regex temizliği **kaldırıldı**: iki ayrı "JSON'ı temizle" mantığı, biri
  güncellenip diğeri unutulunca ayrışır. Üstelik elle yazılan sürüm daha zayıftı —
  JSON'un başına eklenen açıklamayı ayıklamıyordu.
- Çıktının **şekli** Zod ile doğrulanıyor; `issue-generator`'da **boş liste de
  reddediliyor** ("üretildi" deyip hiçbir şey üretmemek, mock'a düşmekten daha sinsi).
- **Düşüş sessiz değil**: `cozVeDogrula` sayacı artırıyor (#335) ve çağıran taraf
  ayrıca loglıyor.

### Mentör Onay Kapısı — Revizyon (#379)
Öğrenci bir adımı `COMPLETED` yaptığında **kimse** geri çekemiyordu: öğrenci ucu
"tamamlanan adımın durumu değiştirilemez" diyor, mentör ucu `status` alanını hiç kabul
etmiyordu (`delete safeData.status`). Bir staj platformunda mentör onayı akışın
merkezinde olmalı.

- **Yeni durum `REVISION_REQUESTED`** — `IN_PROGRESS`'e geri çekmek yerine. Revizyon
  istendiği bilgisi panoda **hiç çalışılmamış adımdan ayırt edilebilmeli** ve
  `StepStatusHistory`'de (#324) net iz kalmalı.
- **Gerekçe ZORUNLU** (`StepStatusHistory.note`, ≥10 karakter) ve öğrenciye gösterilir —
  #366'daki red gerekçesi deseni. Gerekçe **adımda değil GEÇİŞTE** duruyor: bir adım
  birden çok kez revize edilebilir, her seferin kendi gerekçesi var.
- **⚠️ YETKİ TAM AÇILMADI, DARALTILDI.** `delete safeData.status` kaldırılmadı; ayrı bir
  uç yalnızca **tek geçişi** açıyor: `COMPLETED → REVISION_REQUESTED`. Mentör adımı
  keyfî durumlara sürükleyemez.
- Yetki: atanmış mentör (bireysel **veya** takım — `mentorunOgrencisiWhere`, #370) + admin.
  "Yetki yok" da **404** döner: başkasının adımının var olduğu bile sızmasın.
- **Öğrenci yeniden başlatabilir**, doğrudan tamamlayamaz — TODO'daki kuralın aynısı.
  Aksi halde "revize et" demek adımı **kilitlerdi**.
- **Proje `COMPLETED` kalmaz**: öğrenci ucundaki yeniden hesap bu geçişte çalışmıyordu;
  bir adımı revizyonda olan proje panoda "tamamlandı" görünürdü.
- Mezun (`GRADUATED`) stajyerde kapalı (#208).

#### ⚠️ Webhook `reopened` REVİZYON DURUMUNU EZMEZ (#378)
Webhook yalnız `closed` dinliyordu; yanlışlıkla kapatılan bir issue geri açıldığında
adım `COMPLETED` kalıyor, kaynak ile ayna sessizce ayrışıyordu. Artık `reopened` de
işleniyor (`issues` ve `pull_request`).

**Tuzak:** #379 revizyon istendiğinde issue'yu **kendisi yeniden açıyor** ve GitHub o
işlemin webhook'unu bize geri gönderiyor. Körlemesine `IN_PROGRESS` yazan bir sürüm,
mentörün az önce koyduğu `REVISION_REQUESTED` durumunu **kendi tetiklediğimiz olayla**
silerdi. Bu yüzden yalnızca `COMPLETED` geri çekiliyor; diğer durumlar korunuyor.

#### ⚠️ `ProcessedWebhook` artık temizleniyor (#378)
Şemada `@@index([createdAt])` ve "eski kayıtların temizliği için" notu vardı ama
`deleteMany` **hiç çağrılmıyordu**; tablo yalnızca büyüyordu. `teslimat-kaydi.ts`
fırsatçı temizlik yapıyor (`rate-limit.ts` / `TypingSignal` deseni), pencere **7 gün**.
Pencere GitHub'ın tekrar denemelerinden (saatler) belirgin biçimde uzun olmalı — kısa
tutmak idempotens korumasını delerdi. Kayıt **atıldıktan sonra** çağrılıyor: temizlik
patlasa bile koruma yerinde kalsın.

#### ⚠️ GitHub tarafı: MERGE EDİLDİYSE YENİ ISSUE, EDİLMEDİYSE YENİDEN AÇ
Merge edilmiş bir işin issue'sunu yeniden açmak, **ana dalda duran kodu "yapılmamış"
gibi** gösterirdi; o iş bitti, revizyon yeni bir iştir. `StepIssue.mergeIleKapandi`
webhook'ta yazılıyor (`pull_request` + `merged`), karar buna bakıyor.
- Bu bayraktan **önce** kapanmış kayıtlarda `false` kalır → yeniden açma. Bilinmeyende
  geri alınabilir ve görünür olan tercih edildi.
- **BAGLA/LINKED depolarda hiçbiri çalışmaz** (#366) — sessizce atlanıyor.
- **GitHub hatası revizyonu geri almaz**: platform durumu tek doğru kaynak, senk `after()`
  ile arka planda. Tersi olsaydı GitHub erişilemezken mentör revizyon isteyemezdi.

### Savunma Derinliği Dalgası (#437, #439)

Denetimde bulunan, tek tek küçük ama sınıf olarak tekrarlayan boşluklar.

- **⚠️ #208 MEZUN KAPISI İKİ UÇTA EKSİKTİ** (#437): `steps/[stepId]/assignee` (mezun,
  eski takımının havuzundan iş çekmeye devam edebiliyordu) ve `student/proposals` POST
  (onaylanınca `AssignedProject`'e dönüşen, yani sistem durumunu DEĞİŞTİREN bir uç).
  Kapı ÖĞRENCİYE özel — mentör mezunun panosunu düzenlemeye devam eder; GET açık kalır.
- **⚠️ `ai-step`'TE RATE LIMIT YOKTU** (#437): Gemini çağıran tek limitsiz uçtu, kardeşi
  `generate-roadmap` 60 sn / 5 ile sınırlıydı. Aynı bütçe uygulandı.
- **⚠️ #390 TARAMASI İKİ ALANI KAÇIRMIŞTI**: `interests` ve `expertise`. İkisi de
  `ilgiEtiketi`'nden geçtiği için güvenli sanılmıştı — oysa `ilgiEtiketi` BİLİNMEYEN
  değeri olduğu gibi döndürüyor (`?? deger`) ve şemalar serbest metin kabul ediyor
  (`z.array(z.string())`, enum DEĞİL). Yani sözlükte olmayan her değer prompt'a çıplak
  giriyordu. **`guvenliListe` dört dosyada import edilip hiç kullanılmamıştı** — lint
  uyarısı bunu zaten söylüyordu.
- **⚠️ `Prisma.raw` PARAMETRELEŞTİRMEZ** (#439): `atamaOgrencininSql` takma adı olduğu
  gibi gömüyordu. Bugün yalnız kod içi sabitler geçiyor ("ap"/"ap2"), sömürülebilir yol
  YOK — ama imza `string`'di ve bu, `Prisma.raw`'a giden tek doğrulanmamış girdiydi.
- **⚠️ DEPOLAMA ADI YOL KAÇIŞINA AÇIKTI** (#439): `blob.ts` adı `path.join` ile
  birleştiriyor, GCS tarafında öneke DÜZ METİN ekliyor (`steps/../gizli` aynı kaçışı
  bucket içinde yapardı). Kapı çekirdeğe kondu — sözleşme "adı ver, nereye yazacağımı
  ben bilirim". İkisi de **sessizce kırpmaz, FIRLATIR**: yanlış satırı eşlemektense /
  yanlış dosyayı okuyup silmektense patlaması yeğdir.
- **⚠️ ESKİYEN GEREKÇE: `saveOnboarding`** (#439). Dosyadaki yorum "requireAuth
  KULLANILMAZ, akışı kırar" diyordu ve bu #143'ün `allowUnapprovedStudent` seçeneği
  EKLENMEDEN ÖNCE doğruydu. Seçenek geldi, API uçlarına uygulandı, **bu çağrı yeri
  taşınmadı**. Kaçan iki soru: (1) REJECTED stajyer — middleware yalnız SAYFAYI
  kapatıyor, server action doğrudan çağrılabildiği için profil yazılmaya devam
  ediyordu; (2) rol — MENTOR/ADMIN oturumu kendine `StudentProfile` üretip
  `User.name/lastName/phone` alanlarını bu yoldan değiştirebiliyordu. #143 sözleşmesi
  korunuyor: PENDING stajyer profilini tamamlayabiliyor.

### Analitik Panel (#331)
`features/analytics/server/analiz.ts` (üç ham SQL) → `panel.ts` (önbellek) →
`/api/admin/analytics` (platform) · `/api/mentor/analytics` (kapsam OTURUMDAN daraltılır).

- **⚠️ DROP-OFF RİSKİ AI İLE ÜRETİLMİYOR.** Skor yok, SİNYAL var: "14 gündür sessiz",
  "3 adım takılı", "yanıtlanmamış mesajı var". Gerekçe bir açıklama metni değil, verinin
  kendisi. "%73 risk" bir insan hakkında uydurma kesinlik olurdu (#328'deki yüzde kararı).
- **Darboğaz PROJE + ADIM SIRASI ile gruplanır**, başlıkla değil: yol haritaları öğrenciye
  özel üretildiği için başlıklar tutmuyor. Gösterilen başlık gruptan bir ÖRNEK (arayüzde yazılı).
- **Ortanca da dönüyor**; sıralama ona göre — tek bir yarım bırakılmış adım ortalamayı uçurur.
- **Üçü de TEK sorgu, toplama veritabanında.** Satırları çekip JS'te gruplamak öğrenci
  sayısıyla havuzu tıkardı (#313 dersi). `unstable_cache` 5 dk — panel, izlediği sistemi
  yavaşlatan şey olmamalı. Önbellek anahtarı KAPSAMI içerir, yoksa mentöre admin verisi gider.
- Mentör yanıt süresi bir performans ölçümü: **mentörleri karşılaştıran sıralama YOK**,
  mentör kendi sayısını görür.
- ⚠️ Ham SQL gerçek Postgres'e karşı, ekilmiş bilinen değerlerle doğrulandı; birim testler
  yalnız sorgu SONRASI dönüşümleri kapsıyor (mock Prisma SQL'i kanıtlamaz).

### Takılma Radarı (#397)
`features/radar/` — stajyer bir adımda takılınca **mentöre** bildirim, **öğrenciye** (izin
verirse) hatırlatma.

- **⚠️ SKOR YOK, SİNYAL VAR** (#331'in aynısı). Mentöre gösterilen şey verinin kendisi:
  "3 gündür bu adımda, GitHub'da da hareket yok".
- **⚠️ ÖĞRENCİ BİLDİRİMİ OPT-IN, VARSAYILAN KAPALI** (`StudentProfile.takilmaBildirimi`).
  Posilog bugüne kadar yalnız YANIT veriyordu; kendiliğinden yazmak yeni bir davranış ve
  istenmeyen temas taciz gibi hissettirebilir. **Bilinen bedeli:** tam da hedef kitle
  (çekingen stajyer) ayarı açmayı akıl etmeyebilir — bu yüzden ayar panoda **görünür**
  yerde ve metin "gözetleniyorsun" değil "yardım isteyebilirsin" tonunda.
- **Mentör bildirimi bu ayardan BAĞIMSIZ.** Mentörün öğrencisinin takıldığını bilmesi,
  öğrencinin kendi tercihine bağlanamaz.
- **⚠️ "VERİ YOK" ≠ "SİNYAL YOK".** Commit sinyali webhook `push` olayından geliyor ama
  **BAGLA depolarında webhook hiç çalışmıyor** (#366) ve kurulmamış atamalarda da gelmez.
  `sonCommitAt` NULL ise mentöre **açıkça** "bu projede GitHub verisi yok" yazılıyor;
  yoksa o öğrenciler radarda sessizce eksik görünürdü.
- **Adım başına BİR kez** — tekrar koruması `Notification.refId` ile veritabanında.
- **Mezun (`GRADUATED`) kapsam dışı** (#208).
- **⚠️ ZAMANLAYICI YOK.** Tarama #329'un mevcut tikinden, **saatte bir** tetikleniyor.
  Bilinen sınır: tik yalnız en az bir kullanıcı bağlıyken çalışır, yani kimse çevrimiçi
  değilken tarama yapılmaz. Alıcı mentör olduğu için kabul edilebilir gecikme.

### Yol Haritası Adım Sıralaması (#406) ve Adım/Yol Haritası Bağı (#411)

Adımın sırası arayüzden **hiç** değiştirilemiyordu: düzenleme formu `title`,
`description`, `estimatedHours`, `resources`, `githubIssueUrl` tutuyordu, `order`
yoktu. AI sırayı yanlış kurduğunda mentörün tek çaresi adımı silip yeniden yazmaktı.

- **Sıralama AYRI bir uçta** (`POST .../steps/reorder`). Mevcut `PUT .../steps/[stepId]`
  tek bir adımın `order`'ını kabul ediyordu; komşusu güncellenmeden yazılırsa iki adım
  aynı sırada kalırdı. İstemci sıra numarası **hesaplamıyor**, yalnız "hangi adım,
  hangi yön" diyor.
- **⚠️ SIRA HER YAZMADA 1..n YENİDEN NUMARALANIR** (`roadmap/server/siralama.ts`).
  İki kaydı takas etmek, veride zaten bozuk bir sıra varsa (AI'ın dönebildiği
  yinelenen/atlamalı `order`, #410) bozukluğu KORURDU. Tamamı tek `$transaction`
  içinde; `(roadmapId, order)` benzersiz olmadığı için ara durumda çakışma yok.
- Sıralama `order`, eşitlikte `createdAt` ile çözülür — bozuk veride aynı düğmeye
  iki kez basmak aksi halde farklı sonuç verirdi.

#### ⚠️ YETKİ YOL HARİTASINDA, İŞLEM ADIMDA — bağ sorulmalı (#411)

`PUT`/`DELETE .../roadmap/[roadmapId]/steps/[stepId]` yetkiyi **yol haritası**
üzerinde kontrol ediyor ama işlemi `where: { id: stepId }` ile yapıyordu. Mentör
kendi yol haritasının kimliğini URL'e koyup **başka bir stajyerin adımının**
kimliğini vererek o adımı **düzenleyebiliyor ve silebiliyordu**. `DELETE` ayrıca
silme sonrası sırayı URL'deki `roadmapId`'ye göre numaralandırdığı için hasar iki
yol haritasına birden dağılıyordu: adım birinden siliniyor, **diğeri** yeniden
numaralanıyordu. Canlı olarak doğrulandı (kurbanın başlığı değişti, sırası
`1, 3` boşluklu kaldı).

İşlem artık `where: { id: stepId, roadmapId }` ile daraltılıyor; bulunamayan adım
**404** (başkasının adımının var olduğu bile sızmasın). Yeniden numaralandırma
ortak yardımcıdan geçiyor.

⚠️ **Kardeş uçlarda bu hata YOK**: `steps/[stepId]/assignee`, `comments`, `files`
yetkiyi ADIMIN KENDİSİNDEN türetiyor ve URL'de `roadmapId` taşımıyor. Hata yalnızca
**her iki kimliği de URL'den alıp birini kontrol edip diğerine yazan** uçta vardı.

⚠️ `PUT` artık `order`'ı da yok sayıyor (`status` gibi). Yazılacak alan kalmadıysa
güncelleme HİÇ çağrılmıyor: Prisma boş `data` ile `count: 0` döndürüyor ve bu, var
olan bir adım için yanıltıcı 404 üretiyordu (canlı testte bulundu).

### AI Yol Haritası Üretiminin Girdileri (#410, #423)

Prompt yalnız üç şey görüyordu: `experienceLevel`, `interests`, `goals`. Oysa
platform her stajyer için #47'de zengin bir analiz üretip **kalıcı saklıyor**.

- **⚠️ `ProfileAnalysis` prompt'a giriyor** (`strengths`, `developmentAreas`,
  `recommendedPath`). Canlı Gemini ile ölçüldü: analizsiz üretimde veritabanı 3.
  adımdaydı ve test hiçbir adımda yoktu; analizle veritabanı modelleme 1. adıma
  çıktı, testler 4/5 adıma girdi, arayüz sona bırakıldı — `recommendedPath`'in
  dediği sıra birebir yansıdı.
- **⚠️ ANALİZ YOKSA ÇÖKMEZ**, eski davranışa düşer: henüz üretilmemiş ya da rıza
  geri alınınca SİLİNMİŞ olabilir (#352).
- **⚠️ MENTÖR YÖNLENDİRMESİ ANALİZDEN ÖNCELİKLİ** ve bu prompt'ta AÇIKÇA yazılı.
  İkisi çelişebilir (analiz "önce veri modeli", mentör "önce arayüz"); sessizce
  yarışırlarsa hangisinin kazandığı modele kalır ve çıktı açıklanamaz olur. Mentör
  insan, analiz türetilmiş bir tahmin. Analiz bloğu SİLİNMİYOR, sıralanıyor.
  Ölçüldü: "her adımda test yaz, CI kur" yönlendirmesiyle test/CI geçen adım
  **0/7 → 5/5**.
- **⚠️ GEÇMİŞ İŞ prompt'a giriyor** (`roadmap/server/gecmis.ts`). İkinci projesinde
  stajyer yine "Proje Kurulumu ve Gerekli Araçlar" adımını alıyordu. Ölçüldü:
  geçmişle örtüşen adım **3/6 → 0/4**. Yalnız BAŞLIKLAR ve en yeni 20 tanesi gidiyor
  (prompt bütçesi); sahiplik `sahiplik.ts`'ten sorulur (takımda `studentProfileId`
  NULL).
- **⚠️ MENTÖR METNİ DE KULLANICI METNİDİR** — `veriBlogu` ile sarılır (#390).
  "Yetkili kişi yazdı" varsayımı #390'da tam olarak bu yüzden reddedilmişti.

#### ⚠️ Çıktı doğrulaması sayıları da sınırlar
`estimatedHours` 1–60; dizi `.min(4).max(7)` (prompt 4–7 adım isterken şema TEK
adımlı yol haritasını sessizce geçiriyordu — "üretildi" deyip tek satır vermek
mock'a düşmekten sinsi, #377 kararının aynısı). **Modelin `order` değeri
veritabanına olduğu gibi yazılıyordu**; artık 1..n yeniden numaralanıyor.
Prompt **arama terimi** istiyor, URL değil: uydurma bir kaynak linki hiç link
olmamasından kötü (stajyer tıklar, 404 alır). Canlı ölçümde dönen kaynakların
**0'ı URL'di**.

### 1-e-1 Ofis Saati (#398)
`features/ofis-saati/` — mentör müsait bir aralık açar, sistem **20 dakikalık**
dilimlere böler, stajyer tek tıkla rezerve eder.

- **⚠️ AI HİÇ KARIŞMIYOR.** Görüşme notu mentörün kendi cümleleri: kayıt resmî ve
  öğrenci hakkında; AI'ın genişlettiği bir cümle mentörün sözü gibi durur ve öğrenci
  itiraz ederse kimin sözü olduğu belirsiz kalır.
- **⚠️ ÇİFT REZERVASYON VERİTABANINDA ENGELLENİR.** Tek koşullu UPDATE
  (`id` eşleşsin **VE** `rezerveEdenId` NULL olsun); yarışı kaybeden `409` alır.
  "Önce sorgula sonra yaz" bu yarışı kaybederdi (#345/#349/#366 dersi).
- **⚠️ ÇİFT AÇMA DA VERİTABANINDA** — `@@unique([mentorId, baslangic])`. **Canlı
  testte bulundu:** "Aralık aç" iki kez çalışınca takvim ikizleniyor, stajyer aynı
  14:00 dilimini iki kez görüyordu. `createMany` `skipDuplicates` ile idempotent:
  14:00–15:00 açtıktan sonra 14:00–16:00 açmak meşru bir istek, hata değil.
  Dönen `count` **gerçekten oluşan** sayı — arayüz atlananları saymıyor.
- **⚠️ YETKİSİZLİK DE `slot-yok` DÖNER** (404). Başkasının takvimindeki bir slotun
  **var olduğu** bile sızmamalı. "Bu öğrenci benim mi" sorusu `mentorunOgrencisiWhere`
  (#370) — bireysel **veya** takım bağı.
- **⚠️ GÖRÜŞME BAĞLANTISI YALNIZ REZERVE EDİLMİŞ SLOTTA DÖNER.** **Canlı testte
  bulundu:** arayüz "rezervasyon sonrası görürsün" diyordu ama API bağlantıyı her
  slotta dönüyordu — mentörün kalıcı toplantı odası rezervasyon yapmamış her
  stajyerin ağ yanıtında duruyordu. Sözü tutan yer **sunucu**.
- **⚠️ OTOMATİK MEET LİNKİ ÜRETMİYORUZ.** Google Calendar entegrasyonu yeni bir OAuth
  akışı, token saklama ve mentörün takvimine erişim demekti — yeni bir KVKK
  aydınlatma yüzeyi (#330'da sesli/görüntülü görüşme aynı gerekçeyle kapatılmıştı).
  Mentör kendi linkini bir kez giriyor; **yalnız http(s)** kabul ediliyor — aksi
  halde stajyerin tıkladığı yerde `javascript:` çalıştırılabilirdi.
- **⚠️ SAAT UTC SAKLANIR, YEREL GÖSTERİLİR.** `dilimlereBol` bilerek **epoch
  aritmetiği** kullanıyor; takvim alanlarıyla (`setMinutes`) yaz saati geçişinde
  bir dilim 80 dakikaya sıçrıyor. **Test kendi saat dilimini değiştirmek zorunda:**
  geliştirme makineleri UTC+3'te ve Türkiye yaz saati uygulamadığı için hatalı bir
  uygulama testten geçerdi (mutasyon testinde ölçüldü).
- **Artan kısım ATILIR**: 50 dakikalık aralık 2 dilim verir, 2,5 değil — yarım dilim
  rezerve edilirse görüşme süresi sözleşmesi bozulurdu.
- **REZERVE EDİLMİŞ SLOT SİLİNEMEZ**, önce iptal edilmeli — aksi halde stajyerin
  görüşmesi habersiz kaybolurdu. İptal edilen slot yeniden **BOŞA** düşer.
- **⚠️ MEZUN (`GRADUATED`) STAJYER REZERVE EDEBİLİR** — #208 ayrımı: *sistem
  durumunu değiştiren* ve *ücretli AI* uçları kapalı, *insan iletişimi* açık.
  Görüşme mesajlaşmanın eşi (referans, kariyer tavsiyesi) ve kıtlık mentörün
  kendi kontrolünde — slotu o açıyor, iptal edebiliyor.
- **Bilinen sınır:** bağlantı alanı `MentorProfile`'da, o da yalnız başvuru akışında
  (#287) oluşuyor. Seed/admin eliyle açılan mentör **slot açabilir ama bağlantı
  kaydedemez**; hata mesajı bunu açıkça söylüyor.
- **⚠️ SLOT AÇMADA TAVAN VAR** (#443): uç satır ÜRETİYOR (tek çağrı `AZAMI_DILIM` = 24
  satır). Asıl risk isteğin tekrarı DEĞİL — o zaten `@@unique` + `skipDuplicates` ile
  0 satır ekliyor — **pencereyi kaydırarak ileri tarihlere sınırsız takvim açmak**.
  Mentör güvenilen bir rol olduğu için tavan CÖMERT (60 sn / 20): amaç kötüye kullanımı
  değil kaza eseri döngüyü kesmek.
- **⚠️ TESTLER MODÜLDE VARDI, ROTALARDA YOKTU** (#443). `ofis-saati.ts` 33 testle
  kapsanmıştı; boşluk HTTP katmanındaydı ve orada modülün göremeyeceği kararlar var:
  `?tamamen=1` bayrağı İSTEMCİDEN gelir ve yalnız MENTOR'e açıktır (rol kontrolü olmasa
  stajyer mentörün takvim satırını tamamen kaldırabilirdi), "slot-yok" → 404 ama
  "dolu" → 409 (ikisi de 404 olsaydı istemci "silinmiş" ile "az önce kapıldı"yı ayırt
  edemezdi), ve mezunun rezerve EDEBİLMESİ #208'in bilinçli istisnası olarak test
  edilir — "eksik kapı" sanılıp kapatılmasın diye.

### Taslak Yol Haritası Görünürlüğü (#405)

Mentör yol haritası oluşturduğunda varsayılan `DRAFT`; yayınlanmazsa **stajyerin
panosunda hiçbir adım görünmüyor** ve kimse fark etmiyordu.

- **⚠️ SORUN DURUMUN GÖRÜNMEMESİ DEĞİL, SONUCUNUN SÖYLENMEMESİYDİ.** Yol haritası
  sayfasında zaten "Taslak" rozeti vardı; eksik olan "stajyer hiçbir adımı
  göremiyor" cümlesiydi.
- **⚠️ Asıl körlük sayfanın DIŞINDAYDI.** Mentör panosunda ve öğrenci detayında
  hiçbir işaret yoktu — üstelik öğrenci detayı taslak bir rotaya **"AI Rotası
  HAZIR"** diyordu, yani gerçeğin tersi. Yanlış bir işaret, işaretsizlikten zararlı.
- Metin tek kaynakta (`features/roadmap/taslak.ts`); üç yüzeyde farklı sözcük
  kullanmak aynı durumu farklı şeyler sanmaya yol açardı.
- **⚠️ UYARILAR ENGELLEYİCİ DEĞİL**: taslağa geri almak düzenleme sırasında meşru.
- `getMentorStudents` bireysel projelerde `roadmap` alanını hiç çekmiyordu; takım
  projelerinde **zaten seçiliydi ama hiç kullanılmıyordu**.

### Öğrenci Panosunun Yoğunluğu (#415, #416, #417, #420)

Ölçüldü (1280×900, **yalnızca 3 adımlık** yol haritasıyla): sayfa **3388px
(3.8 ekran)**, ilk adım kartı **2366px aşağıda (2.6 ekran)**, "Kendi projeni öner"
formu tek başına **745px** — üç adım kartının toplamından (706px) BÜYÜK.

**⚠️ Kök sebep: sayfa kullanım sıklığına göre değil, ÖZELLİKLERİN EKLENME SIRASINA
göre dizilmişti.** #397, #366 ve #398 geldiklerinde çalışma alanının üstüne kondular.

- **#415 — idari bloklar tek katlanır bölümde** (`<details>`, istemci durumu değil:
  sunucu bileşeni kalıyor, JS'siz çalışıyor). **Sekme YAPILMADI**: yeni gezinme
  modeli + derin bağlantı + "her şey nerede" hissinin kaybı; katlanır blok aynı
  kazancı sıfır gezinme değişikliğiyle verdi.
  ⚠️ Takılma bildirimi (#397) ayarının ADI ve DURUMU katlanmış başlıkta yazılı —
  opt-in'in bilinen bedeli tam da çekingen stajyerin ayarı fark etmemesiydi.
  ⚠️ Özeti İÇERİĞİ SEÇEN taraf kurar: sabit liste, mezunda olmayan formu
  duyuruyordu (canlı testte bulundu).
  ⚠️ Blok, bekleyen iş varken AÇIK gelir — `#profil` çapası kapalı `<details>`
  içindeyken "Fotoğraf ekle" bağlantısı Chrome 148'de ne bloğu açtı ne kaydırdı.
- **#416 — "bugünün odağı" kartı.** ⚠️ YENİ İŞARET DEĞİL: panoda zaten "SIRADA"
  bağlantısı vardı (#290), eksik olan EYLEMDİ. Kart varken karşılamadaki bağlantı
  **bastırılır** (aynı bilgi iki yerde ayrışırdı).
  ⚠️ **ÖNCELİK "tamamlanmamış ilk adım"dan FARKLI**: revizyon istenen adım her şeyin
  önünde, sonra devam eden, sonra eyleme açık ilk adım. Eski kural, 1. adım devam
  ederken 2. adım revizyona düştüğünde mentörün geri gönderdiği işi HİÇ göstermiyordu.
  ⚠️ Kural tek kaynakta: `roadmap/odak.ts` (`adimKilitli`, `adimEylemeAcik`,
  `odaktakiAdimIndeksi`) — `RoadmapSteps` de oradan geçer.
- **#417 — tamamlanan adımlar katlanır.** Ölçüldü: 8 tamamlanmış adımla
  **4522px → 2298px (−%49)**. ⚠️ ARDIŞIK RUN'lar hâlinde, "tüm tamamlananlar" olarak
  değil: adımlar her zaman sırayla bitmiyor ve hepsini tek yere yığmak zaman
  çizgisini bozardı. ⚠️ Revizyon istenen adım gruba GİRMEZ. ⚠️ MEZUNDA VARSAYILAN
  AÇIK (#208 — portfolyo sertifikanın dayanağı). Tercih kalıcı değil.
- **#420 — öneri ve ofis saati kendi sayfalarına taşındı**, üst menüden erişiliyor.
  ⚠️ Mezunda "Projemi Öner" gizli ve sayfa yönlendiriyor (#208), "Mentör Görüşmesi"
  AÇIK (#398 — insan iletişimi). ⚠️ Rezervasyonu OLAN öğrenci panoda hatırlatma
  görmeye devam eder: "rezerve edilmiş görüşme zamana bağlı bilgidir, saklanırsa
  kaçırılır" (#398).

Sonuç: **3388px → ~2200px**, ilk adım **2.6 → 1.5 ekran** (odak kartı EKLENDİKTEN
sonra).

### İlerleme Takibi (#432)

`features/progress/ilerleme.ts` — ilerleme yüzdesi ve duraklama, admin ile mentör
arasında TEK kaynaktan. Hesap `assignment-progress.ts` içinde gömülüydü ve mentör
panosunda hiç yoktu.

- **Admin**: mentöre göre FİLTRE + duraklama işareti. ⚠️ **FİLTRE, SIRALAMA DEĞİL** —
  #331'de mentörleri yanıt süresine göre sıralayan liste bilerek reddedilmişti.
  ⚠️ "Mentörü yok" ayrı bir seçenek: mentörsüz atamalar tam da gözden kaçmaması
  gereken satırlar.
- **Mentör**: pano kartlarında ilerleme çubuğu + duraklama (öncesi yalnız
  aktif/tamamlanan sayacıydı, #393).
- **⚠️ YENİ EŞİK UYDURULMADI**: `SESSIZLIK_GUN = 10` zaten analitikteydi. Eşikler
  `analytics/sabitler.ts`'e taşındı — `server/analiz.ts` `server-only` + prisma
  çekiyor, sabitleri oradan almak sunucu kodunu istemci paketine sürüklerdi.
- **⚠️ SKOR DEĞİL SİNYAL** (#331/#397): "14 gündür hareket yok". Tamamlanmış iş
  duraklamış sayılmaz (mezun portfolyosu aksi halde baştan sona duraklamış görünürdü).
  "Adım yok" ile "hiç ilerlemedi" ayrı şeyler.

### Kalıcı Bildirimler (#380)
`Notification` tablosu + `features/bildirim/`. Kullanıcı bir şeyin olduğunu ancak ilgili
sayfayı ziyaret ederse öğreniyordu.

- **⚠️ KALICI — #329'un AKSİNE.** Canlı akış olayı yalnız AÇIK sekmeye taşıyor; sekme
  kapalıysa kaybolur. Bildirimin bütün değeri "yokken olanı sonradan görmek".
- **⚠️ E-POSTA LİSTESİ DAR VE BİLİNÇLİ:** hesap kararı, mentör ataması, öneri (#366) ve
  çalışma alanı (#349) kararı. Ortak özellikleri: **kullanıcı sonucu öğrenmek için giriş
  yapamayabilir ya da günlerce bekliyordur** — reddedilen hesap sahibi panele zaten giremez.
  **"Yeni mesaj" dışarıda**: sıklığı yüksek, olay başına e-posta karşılıklı sohbette
  gürültüye dönerdi.
- **⚠️ E-POSTA GİTMESE DE SATIR DÜŞER** (`mail.ts`'in #241 sözleşmesi). Tersi olsaydı SMTP
  kesintisinde bildirimler tamamen kaybolurdu. **Kayıt patlarsa e-posta GÖNDERİLMEZ** —
  kullanıcı e-postayı görüp uygulamada karşılığını bulamamalı.
- **⚠️ HİÇBİR DURUMDA FIRLATMAZ.** Bildirim, tetikleyen işlemin (hesap onayı, mentör
  ataması) yan etkisi; admin bir hesabı onaylayamıyorsa sebebi bildirim tablosu olmamalı.
- **Okunmamış sayacı #329'un MEVCUT TİKİNDEN** besleniyor, yeni altyapı yok (#354 deseni);
  yalnız **değiştiğinde** yollanıyor.
- **Kapsam her zaman OTURUMDAN**; `userId` istemciden alınmıyor.
- **Tercih ekranı ilk sürümde YOK.** Bedeli açık: e-posta hacmi yanlış ayarlanırsa kaçış
  yolu olmaz — liste tam bu yüzden dar.
- E-posta gövdesi **asgari veri** taşır, detay için panele yönlendirir (KVKK, #321).
- Mentör atamasında **yalnız YENİ bağlar** bildiriliyor: reconcile her çağrıda tüm listeyi
  yazıyor, hepsini bildirmek listeden tek kişi çıkınca kalan herkese "yeni mentör" göndermek
  olurdu.

### Mentör Yükü ve Rıza Görünürlüğü (#404, #394)

**#404 — admin mentör atarken yükü görüyor.** Açılır listede yalnız ad + e-posta
vardı. `MentorProfile.capacity` alanı **zaten tanımlıydı ve hiç kullanılmıyordu**;
artık "1/3 stajyer" gösteriliyor.

- **⚠️ SAYIM İKİ YOLDAN BAĞI DA SORAR** (`ogrenciMentoreBagliSql`): bireysel
  `MentorAssignment` VEYA takım üzerinden `TeamMentor`. Yalnız ilkine bakan bir
  sayaç takımı olup bireysel bağı olmayan stajyerleri sessizce düşürürdü — #393'te
  tam olarak bu yaşandı. Kural kopyalanmadı: `sahiplik-sql.ts`'teki koşul sütun
  ifadesi alacak şekilde genelleştirildi, SQL tarafında tek tanım korundu.
- **⚠️ MEZUN VE REDDEDİLEN SAYILMAZ**: kapasite EŞZAMANLI yükü anlatır; sayarsak
  eski mentörler kalıcı olarak "dolu" görünür ve yeni atama alamazdı.
- **⚠️ KAPASİTE BEYAN EDİLMEMİŞSE ORAN GÖSTERİLMEZ**, yalnız sayı. Uydurma bir
  payda, olmayan bir sınırı varmış gibi gösterirdi (#328'in "yüzde skor üretme"
  kararı).
- **⚠️ DOLU/AŞKIN MENTÖR ENGELLENMEZ** — geçici devir meşru olabilir; son söz admin'in.

**#394 — AI kod incelemesi engellendiğinde mentör sebebini görüyor.** Kural
DEĞİŞMEDİ: takım deposunda HERKESİN güncel rızası aranıyor, çünkü ortak repoda
hangi satırı kimin yazdığı bilinmiyor. Eksik olan SESSİZLİKTİ — engelleme hiç
kimseye söylenmiyordu (sayaç artıyordu ama o yalnızca teşhis).

- **⚠️ ÖNCE MENTÖR YÜZEYİ, PR yorumu DEĞİL.** Durumu düzeltebilecek kişi rıza
  vermemiş ÜYE, ama PR'ı zaten başkası açtı ve yorumu okuyacak kişi sorunu
  ÇÖZEMEYECEK olan. Ayrıca BAGLA/LINKED depolarda yorum yazma yetkimiz yok (#366).
- **⚠️ İSİMLER YALNIZ MENTÖR YÜZEYİNDE.** Üyeler arasında isim paylaşmak baskı
  yaratır ve rızayı "özgür irade" olmaktan çıkarır (#352).
- **⚠️ LINKED depoda RIZA DEĞİL DEPO sebebi gösterilir** — orada inceleme zaten
  çalışmıyor; rıza durumunu göstermek yanlış sebebi işaret ederdi.
- Kural da açıklanır ("hangi satırı kimin yazdığı bilinmediği için"), yoksa mentör
  kuralı hata sanar — denetimde tam olarak bu olmuştu.

### Küçük ama ölçülmüş düzeltmeler (#407, #408, #409)

- **#407 — adım kartında yorum sayısı.** ⚠️ "YENİ" DEĞİL, TOPLAM: `StepComment`'ta
  okunma izi YOK; okunma izi olmadan "yeni" demek uydurma olurdu. Sayı liste
  sorgusundan (`_count`) — adım başına istek N+1 üretirdi (canlı ölçüldü: 0 ek istek).
- **#408 — öneri formunda karakter sayacı** + ölçülmüş bir açık: şema
  `.min(30).transform(trim)` sırasındaydı, yani **35 BOŞLUK `min(30)`'u geçiyor ve
  BOŞ STRING kaydediliyordu**. `.trim().min(30)` sırasına alındı. Eşikler
  `ONERI_SINIRLARI`'nda tek kaynakta. Düğmenin pasif olması KOLAYLIK, güvenlik
  değil — sunucu aynı kuralları doğruluyor.
- **#409 — admin menüsü etiketleri kısaltıldı** (821px → 651px; 1024px'te 149px
  görünmezken artık **0**). ⚠️ AÇILIR MENÜ YAPILMADI: `UnreadBadge` ve
  `BekleyenTalepRozeti` bağlantıların İÇİNDE; taşınan bir öğenin rozeti görünmez
  olurdu ve kaybedilen şey bir özellik değil BİLDİRİM olurdu (#349).
  ⚠️ "İstekler" (#147) ile "Öneriler" (#366) FARKLI şeyler — kısa adlar
  karışmamalı.

### Liste Sayfalama ve Sunucu Tarafı Süzme (#446/#448, #452)

İki admin listesi de tüm tabloyu tek yanıtta döndürüyordu. Ölçüldü (üretim derlemesi,
1406 atama / 9838 adım): `/api/admin/assignments` **1,04 MB**.

- **⚠️ NAİF `take` ÜÇ ŞEYİ BİRDEN SESSİZCE BOZAR** (#448'in dersi): arama yalnız yüklü
  sayfayı tarar (**admin var olan kaydı arayıp "sonuç yok" görür** — en sinsi yan
  etki), sekme filtresi yalnız yüklü sayfayı süzer, sayaçlar "yüklenmiş kadarını"
  gösterir. Bu yüzden arama, filtre ve sayaçların **üçü de sunucuya taşındı**.
- **⚠️ SAYAÇLAR AYRI VE TOPLU SORGUDAN** — sayfadan bağımsız. Toplama veritabanında
  (#313 dersi), sıfır satır JS'e çekiliyor.
- **⚠️ #452'DE SAYAÇLAR DURUM SÜZGECİNİ ALMAZ, yalnız mentör süzgecini alır — bunu
  "filtre sayaçlara uygulanmamış" sanıp düzeltmeyin.** Atama panosu üç sekmenin
  ("Tümü" / "Repo Bekleyenler" / "Repo Açılmış") sayısını AYNI ANDA gösteriyor; açık
  sekmenin süzgecini sayaçlara da uygulasaydık diğer ikisi sıfır görünürdü. Mentör
  süzgeci ise sayaçlara DA uygulanır — kapsam daraldıysa sayı da daralmalı.
- **⚠️ SIRALAMA İKİ ALANLI** (`createdAt desc, id desc`). Tek alanlı sıra, aynı saniyede
  oluşmuş kayıtlarda (seed, toplu içe aktarma) imleçli sayfalamada satır **ATLATIR ya da
  TEKRARLATIR**. Canlıda doğrulandı: 1406 kayıt imleçle gezildi, 1406 benzersiz, 0 tekrar.
- **⚠️ KATEGORİ TANIMI TEK KAYNAKTA** (`admin/kategoriler.ts`, #448). Kategoriler
  filtrede ve sayımda İKİ KEZ elle yazılıydı; ikisi tesadüfen uyuşuyordu çünkü ikisi de
  aynı listeyi geziyordu. Liste ile sayaçlar artık AYRI sorgular — tanım ikiye ayrılırsa
  "MENTOR" sekmesi 7 satır gösterip rozetinde 9 yazar ve **bu hata gibi görünmez**
  (#393'ün aynısı). Modül prisma import ETMEZ: etiketler de aynı tanımı kullanıyor,
  sunucu kodu istemci paketine sürüklenmemeli (#432).
- **⚠️ ARAMA KELİMELERE BÖLÜNÜR**: istemci `${name} ${lastName}` BİRLEŞİK metninde
  arıyordu; alanları ayrı arayan naif bir karşılık "Ayşe Yılmaz" aramasını sessizce kırar.
- **`limit` TAVANLI (200)** — istemci dev bir limitle sayfalamayı atlayamasın.
- **⚠️ İSTEMCİDE KALAN SÜZGEÇLER SAYFALAMAYLA BOZULUR**: `TakimYonetimi`
  `role === "STUDENT"` süzgecini istemcide çalıştırıyordu ve sayfalamadan sonra yalnız
  ilk sayfayı süzüp stajyerlerin çoğunu sessizce gizlerdi (#448'de sunucuya taşındı).
  Aynı sebeple mentör açılır menüsü atamalardan türetilemez, kendi ucundan gelir (#452).
- **⚠️ SÖZLEŞME DEĞİŞİKLİĞİNİ NE TİP SİSTEMİ NE TESTLER YAKALADI** (#452): rota
  `NextResponse.json(data)` diyor, sayfa `res.json()`'u tipsiz alıyor. Dönüş şekli
  diziden nesneye geçtiğinde hiçbir şey uyarmadı — şekil artık testlerle kilitli.

### İlerleme Toplaması Veritabanında (#452)

`/api/admin/assignments` her atamanın **bütün adımlarını** çekip ilerlemeyi JS'te
hesaplıyordu: istek başına **14.241 satır** hidratlanıp yalnız 1406 özet üretiliyordu ve
**adımlar yanıtta dönmüyordu bile**. Süre veritabanında değildi (5 istekte DB 91 ms, uç
~300 ms) — maliyet Prisma'nın satırları JS nesnesine çevirmesindeydi.

Kanıt aynı ölçümde: SQL'de toplayan `/api/admin/analytics` veri 5 katına çıkarken
**sabit kaldı**; JS'te toplayanlar doğrusal büyüdü.

- **⚠️ KURAL KOPYALANMADI, TAŞINDI.** Hesap artık `IlerlemeOzeti` üzerinde tanımlı
  (SQL'in `COUNT`/`MAX` ile ürettiği üç sayı); dizi alan sürümler `ozetle()`'den geçen
  ince sarmalayıcılar. Yüzde formülü, %100 istisnası ve `SESSIZLIK_GUN` eşiği hâlâ TEK
  yerde (#432). SQL için ikinci bir tanım açmak #376'daki "kural iki dilde yaşıyor"
  borcunu gereksizce tekrarlardı. **Aynı gerekçeyle ortalama ilerleme JS'te** hesaplanır:
  atama başına iki tam sayı çekilip formül tek kaynaktan uygulanıyor.
- **⚠️ EŞİTLİK BELİRLİ ÇÖZÜLÜR** (`updatedAt DESC, order DESC`). Eski sıralamada ikincil
  anahtar yoktu: aynı anda güncellenmiş iki adımda "son hareket" veritabanının satır
  sırasına kalıyordu. #406'daki kararın aynısı.
- Sonuç: **271/296/339 ms → 61/62/63 ms**, **1,04 MB → 35,8 KB**, 14.241 → 4.470 satır.
  Toplama düzeltmesi tek başına ~%25 kazandırdı; asıl kazanç sayfalamadan geldi.
- ⚠️ Ölçüm dersi: **dev modunda ya da build çalışırken ölçmeyin.** Bir ölçümde 1150 ms
  görüldü, gerçek değer ~300 ms'ti.

### Gerçek Zamanlı Mesajlaşma (#329)
`GET /api/messages/stream` (SSE) + `features/messaging/server/canli-akis.ts`.
Olaylar: `mesaj`, `okunmamis`, `adim-tamamlandi`.

- **⚠️ "GERÇEK PUSH" DEĞİL — SUNUCU TARAFI TARAMA.** Süreç-yerel yayın listesi çok
  instance'ta SESSİZCE bozulurdu (A pod'una yazılan mesaj B'ye ulaşmaz; #322 zaten çok
  instance diyor). LISTEN/NOTIFY `pg` bağımlılığı + havuz dışı bağlantı + yine de yakalama
  sorgusu isterdi. Seçilen: her pod **TİK BAŞINA SABİT SAYIDA sorgu — kullanıcı
  sayısından bağımsız**. Tasarımın asıl iddiası budur ve ölçümde doğrulandı.
- **⚠️ SAYI "TEK" DEĞİL, BUGÜN ~5** (#458'de ölçüldü: tek SSE bağlantısı, 8 saniyede
  21 sorgu → 2 sn'lik tik başına ~5). Olay türü başına bir sorgu var: `Message` ×2,
  `Notification`, `TypingSignal`, `StepStatusHistory`. Belge "TEK sorgu" diyordu; #354
  ve #380 yeni olay türleri eklerken rakam güncellenmemişti. **Kullanıcı sayısından
  bağımsızlık bozulmadı**, yalnız sabit çarpan büyüdü — ama kapasite planlaması yapan
  biri 5 kat yanılırdı. Yeni bir olay türü eklendiğinde bu rakam da güncellenmeli.
- Yük: bir pod'da **en az bir bağlı kullanıcı varken sürekli ~2,5 sorgu/sn** taban yük
  (tik başına ~5, 2 sn'de bir). Yoklama istemciden sunucuya taşındı.
- **Yoklama KALDIRILMADI, koşullu.** `useCanliAkis` `bagli` döner; istemci yalnız kopukken
  yoklar. SSE'yi kesen bir vekilin arkasında mesajlaşma ölmemeli.
- **İmleç çakışma payıyla geriye çekilir** (kayıp önleme), kopyalar bağlantı başına
  `gorulen` kümesiyle elenir. Tik hata verirse **imleç ilerlemez**.
- Kimse bağlı değilken döngü durur — boş pod sorgu atmaz.
- `: kalp` yorumu 25 sn'de bir: vekiller sessiz bağlantıyı ~60 sn'de keser.
- **Bağlantı SEKME başına TEK** (#358). `useCanliAkis` modül düzeyinde tek `EventSource`'u
  referans sayacıyla paylaşır; kapatma gecikmeli (sayfa geçişindeki unmount/mount çifti
  bağlantıyı yeniden kurmasın). Öncesinde her bileşen kendi bağlantısını kuruyordu ve
  öğrenci mesajlar sayfası **3 kalıcı bağlantı** açıyordu.
  ⚠️ Paylaşımlı durum modül düzeyinde: testlerde `canliAkisiSifirlaForTests()` çağrılmalı.
- **"Yazıyor..." #354 ile eklendi** (aşağıya bakın).

### "Yazıyor..." Göstergesi (#354)
`TypingSignal` tablosu + #329'un mevcut tiki. Yeni altyapı yok.

- **⚠️ SÜREÇ BELLEĞİNDE TUTULMADI.** Sinyal saniyeler yaşıyor, akla ilk gelen bellek;
  ama #329'da elenen hatanın aynısı olurdu — A pod'una yazanın sinyali B pod'una bağlı
  karşı tarafa hiç ulaşmaz ve bu hiçbir yerde hata olarak görünmez.
- **⚠️ YAZMA SATIR BİRİKTİRMEZ.** Bileşik birincil anahtar `(from, to)` sayesinde aktif
  yazan kişi hep AYNI satırı günceller. Ölçüldü: **1 dk kesintisiz yazma = 20 upsert,
  tabloya +1 satır** (mesaj tablosunun aksine kalıcı değil, fırsatçı temizlikle siliniyor).
- **Olay yalnızca DEĞİŞTİĞİNDE gider** (`sonYazanlar` imzası). Her tikte gitseydi biri
  yazarken karşı tarafa 2 sn'de bir olay giderdi — akış yoklamaya dönerdi.
- **"Bıraktı" olayı YOK; küme boşalır.** Gösterge tam durumla sürülüyor, artımlı değil:
  kaçan tek bir "bıraktı" olayı göstergeyi sonsuza dek açık bırakırdı. Sekmesini kapatan
  kullanıcı için sönme de buna dayanıyor (`expiresAt` 7 sn).
- **İstemci KISILIR** (3 sn). Kısılmasaydı hızlı yazan biri saniyede 5–6 istek üretirdi —
  kozmetik bir gösterge mesaj göndermekten pahalı olurdu.
- **⚠️ Erişim kuralı `messaging/server/erisim.ts`'e ÇIKARILDI.** "Yazıyor" sinyali
  mesajlaşmayla AYNI yetkiyi ister; iki yerde ayrı yazılsaydı biri güncellenip diğeri
  unutulduğunda "bu kullanıcı var mı / aktif mi" sorularına yetkisiz yanıt veren bir yan
  kanal kalırdı.
- **Rate-limit SESSİZ geçer**: kozmetik sinyalde hata göstermek mesajlaşmayı bozulmuş
  gösterirdi.
- **Gecikme dürüst rakam: ~2 sn** (tik aralığı). Ölçüldü.

### Akıllı Eşleştirme (#328)
`POST /api/admin/match-mentors` — öğrencinin `ProfileAnalysis`'i ile mentörlerin
`MentorAnalysis.idealStudentProfile`'ını (#288) tek bir Gemini çağrısında sıralar.
**pgvector YOK** (Aşama 1): anlamsal malzeme zaten üretiliyordu, eksik olan sıralamaydı.

- **ÖNERİ ATAMA YAPMAZ.** Uç yalnız sıralama döner; atama admin'in ayrı tıkı
  (`setStudentMentors`). Otomatik atamak, insanın gözden geçirdiği kararı modele devretmekti.
- **⚠️ YÜZDE SKOR ÜRETİLMİYOR.** "%88 uyum" arkasında ölçülmüş bir şey yokken kesinlik
  hissi verir ve admin'i gerekçeyi okumadan güvenmeye iter. Bant (`guclu`/`olasi`/`zayif`)
  + zorunlu gerekçe; okunacak şey gerekçe.
- **Eleme SESSİZ DEĞİL.** Analizi/rızası olmayan mentörler sıralamaya girmez; sayıları
  yanıtta döner — "en uygun 3", adaylar elenmişken yanıltıcı olur.
- **Uydurma mentör kimliği elenir.** Prompt'taki "uydurma" talimatı garanti değil;
  dönen kimlik aday kümesinde yoksa atılır ve sayaç artar.
- **Mentör rızası da aranıyor** — `basvuru.ts` analizi rıza kontrolü yapmadan üretiyor
  (mevcut boşluk); burada aynı boşluk tekrarlanmadı.

### Çalışma Alanı Talebi (#349)
Kurulumu tetikleyen uç ADMIN'e kapalı, ama öğrencinin ne zaman hazır olduğunu bilen MENTÖR.
Mentör **talep eder** (`POST /api/mentor/workspace-request`), admin **karara bağlar**
(`POST /api/admin/workspace-requests/[id]`). Yetki mentöre AÇILMADI: repo açmak geri alınamaz.

- **Bekleyen tekilliği `pendingKey`** ile: PENDING iken `assignedProjectId`, karar verilince
  NULL (Postgres çoklu NULL'a izin verir). Kısmi benzersiz indeks Prisma'da ifade edilemediği
  için bu desen seçildi — kısıt **veritabanında**, "önce sorgula sonra oluştur" değil.
- **Onay `baslatGitHubWorkspaceKurulumu`'dan geçer** — oradaki atomik `PROVISIONING` kilidi
  (#318) atlanmaz.
- **Kurulum sonucu talepte TUTULMAZ.** İş `after()` ile arka planda koşuyor; tek doğru kaynak
  `AssignedProject.githubStatus`. Kopyalansaydı iki kayıt ayrışırdı. Kurulum *başlatılamazsa*
  karar geri alınır, talep PENDING'e döner.
- `ERROR` durumundaki atama **yeniden talep edilebilir** — bir kere patlayan atama kilitlenmemeli.
- Rozet (`BekleyenTalepRozeti`) özelliğin ön koşulu: fark edilmeyen kuyruk darboğazı yalnızca
  yer değiştirir.

#### ⚠️ Hedef hesabın türü TAHMİN EDİLMEZ, SORULUR (#346)
`repos.createInOrg` yalnızca **organizasyonlara** açık; kişisel hesapta 404 verir.
`sahipTuruniCoz` (`github/server/client.ts`) `users.getByUsername` ile türü **sorar**
ve ona göre `createInOrg` / `createForAuthenticatedUser` seçilir.

- **"createInOrg dene, 404 alırsan kişiseldir" YANLIŞ.** 404; silinmiş bir org, yanlış
  yazılmış bir isim veya token'ın o org'u görememesi de olabilir. Sırayla deneyen mantık
  bunların hepsini kişisel hesap sanıp **depoyu başka yere açardı**.
- **⚠️ KİŞİSEL HESAP YALNIZCA TOKEN SAHİBİNİNKİ OLABİLİR.** `createForAuthenticatedUser`
  uçunda `owner` alanı **yoktur** — depo her zaman token'ın sahibi altında açılır.
  `GITHUB_ORG` başka birinin kullanıcı adıysa depo **sessizce yanlış hesapta** açılırdı;
  bu yüzden kimlik karşılaştırılıp uyuşmuyorsa açıkça reddediliyor.
- Tür değişmez → token+owner başına **bir kez** sorulur; **başarısız sonuç
  önbelleklenmez** (geçici hata kalıcı olmamalı). Mevcut repo bulunduğunda tür hiç sorulmaz.

#### ⚠️ GitHub'ın liste uçları ANINDA TUTARLI DEĞİL (#345)
`issueHazirla`/`milestoneHazirla` kopya kontrolünü `listForRepo` başlık taramasıyla
yapıyor ve **bu bir garanti değil**: yeni açılmış kayıt listede gecikmeli görünüyor.
Canlı testte art arda iki çağrı KOPYA issue açtı; üçüncüde (liste yetişince) düzeldi.

İdempotensin otoriter kaynağı **veritabanı**: `provisioning.ts`, `StepIssue.githubIssueUrl`
dolu olan kaydı GitHub'a **hiç göndermiyor**; `RoadmapStep.githubIssueUrl` varsa milestone
numarasını URL'den okuyup yeniden oluşturmuyor. Başlık taraması yalnızca "issue açıldı ama
URL kaydedilemeden süreç öldü" boşluğunu kapatan yedek katman.

Aynı ders #327'de `PullRequestReview` tablosuyla, #349'da `pendingKey` ile uygulandı:
**taramaya değil kısıta/kayda güven.**

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

#### ⚠️ Rıza değişikliğinin TÜREV VERİYE etkisi (#352)
`features/kvkk/riza-etkileri.ts` — rıza açılıp kapanınca yalnız bayrak değişmez:
- **Geri alma → türev analizler SİLİNİR** (`MentorAnalysis` + `ProfileAnalysis`). KVKK m.11
  işlemenin sonucunu da kapsıyor; ayrıca #328 rızasız mentörü zaten sıralamaya almıyordu,
  yani veri duruyor ama kullanılmıyordu. Silme **senkron** (yanıt dönerken silinmiş olmalı).
- **Verme → EKSİK mentör analizi üretilir** (`after()` ile arka planda). Analiz yalnız başvuru
  kaydedilirken üretildiği için, rızasız başvurup sonradan onay veren mentör aksi halde
  eşleştirmeden kalıcı dışlanırdı. Var olan analiz yeniden üretilmez.
- İkisi de **fırlatmaz**: rızayı kaydedememek, türev kaydın bir süre daha durmasından ağır.

#### ⚠️ RIZA SORUSU ARTIK ATAMA DÜZEYİNDE TEK KAYNAKTAN (#389)
`kvkk/riza.ts` `atamaninAiRizasiVar()`. Rıza kontrolü bugüne kadar **her AI çağrısının
yanına elle** yazıldı ve **dört kez atlandı**: #321 mekanizmayı kurdu, #352 mentör
başvurusunu, #389 hem GitHub kurulumunu (`provisioning.ts`) hem `ai-step` ucunu kapattı.
Yeni bir AI çağrısı eklerken rızayı buradan sorun.

- **⚠️ TAKIMDA HERKESİN RIZASI ARANIR.** Üretilen içerik ORTAK panoya yazılıyor, girdi tüm
  üyelerden türüyor (#332'deki PR incelemesi kararının aynısı). Ayrılmış üyenin rızası
  aranmaz.
- **Sahip bulunamazsa `false`** — dayanaksız rıza varsayılmaz.
- **Sürüm kontrolü yok** (`aiRizasiVar`): issue metni yol haritası adımından türüyor,
  #327'deki gibi bir kapsam genişlemesi yok.
- **⚠️ RIZA YOKSA KURULUM ÇÖKMEZ.** Depo/milestone/issue AI'sız da açılır; AI üretimi
  atlanır ve loglanır. Rızanın yokluğu yüzünden çalışma alanını hiç kurmamak cezayı yanlış
  yere keserdi. `ai-step` ise **açık 403** döner — mentör bilerek AI istedi, sessizce
  jenerik bir adım almamalı.

⚠️ Mentör başvurusu (`mentors/server/basvuru.ts`) artık `aiRizasiVar` kapılı — #321 bu
mekanizmayı kurmuştu ama yalnız stajyer akışlarına uygulanmıştı. **Rıza yoksa başvuru YİNE
kaydedilir**, sadece analiz üretilmez (rıza özgür iradeyle verilmeli).

#### ⚠️ Rıza sürümü ve `guncelRizaVar` (#327)
Kod incelemesi öğrencinin **kodunu** da yurt dışına gönderiyor; bu yeni bir veri türü ve
yeni bir amaç, yani eski rıza metnini AŞIYOR. `RIZA_METIN_SURUMU` → `2026-09-v1`.
- `aiRizasiVar` **sürüme bakmaz** — mevcut özellikler (sohbet, analiz) eski rızayla çalışır.
  Her metin düzeltmesinde herkesin AI'ı kapansaydı platform sürekli işlevsiz kalırdı.
- `guncelRizaVar` **yürürlükteki sürümü şart koşar** — yalnızca KAPSAMI genişleyen
  özellikler kullanır. Bugün tek kullanıcısı kod incelemesi.
- Metnin kapsamını genişleten her değişiklikte sürüm artırılmalı ve ilgili özellik
  `guncelRizaVar`'a geçirilmeli.

### KVKK Aydınlatma Metni (#450, #451)

`/privacy` sayfasında beş TODO duruyordu (#321). İkiye ayrıldılar: **kanundan ya da
KODDAN doğrulanabilen** kısım yazıldı, **uydurulamaz** olan yazılmadı.

- Yazıldı: KVKK **m.11** haklarının dokuzu tam metniyle, **m.13** başvuru usulü (yazılı
  ya da Kurulun belirlediği yöntem, en geç 30 gün, ücretsiz), **m.14** şikâyet yolu
  (cevabı öğrenmeden 30, başvurudan 60 gün). Bunlar kanun metni — şirkete göre değişmez.
- **⚠️ ÇEREZ BÖLÜMÜ KODDAN ÇIKARILDI, tahmin edilmedi.** Depo tarandı: yalnız NextAuth'un
  oturum/CSRF/callback çerezleri var; analitik, izleme, üçüncü taraf betiği YOK,
  `localStorage` hiç kullanılmıyor. **Test bunu paragrafın metnine bağlıyor** — biri
  analitik eklerse metnin de güncellenmesi gerektiği görünür oluyor.
- **⚠️ UYDURMA VERİ YERİNE EKSİKLİĞİ SÖYLEYEN UYARI.** Ticari unvan, adres, MERSİS,
  resmî başvuru kanalı, saklama süreleri ve VERBİS yükümlülüğü YAZILMADI — bunlar
  şirketin kendi verileri (VERBİS ayrıca çalışan/ciro eşiğine bağlı, bu depodan
  bilinemez). Yanlış bir unvan/başvuru adresi eksik bilgiden **DAHA ZARARLI**: kullanıcı
  ona güvenip başvurur ve başvurusu hiçbir yere ulaşmaz. Sayfa bunun yerine hangi
  başlıkların yayımlanmadığını açıkça yazıp geçici yol gösteriyor.
- **⚠️ DOLDURMAK TEK DOSYA**: `features/legal/kvkk.ts` içindeki iki `null` gerçek
  değerlerle değiştirildiğinde bölümler otomatik yayımlanır ve uyarı kendiliğinden
  kalkar — sayfa metnine dokunmaya gerek yok.
- Testler iki durumu da kapsıyor (bilgiler girilmeden önce ve sonra); yalnız birini test
  etmek, sayfanın diğer durumda ne gösterdiğini kimsenin bilmemesi olurdu — ve bu
  herkese açık bir hukuki metin.
- **⚠️ TEST METNİN VARLIĞINI ÖLÇER, OKUNABİLİRLİĞİNİ DEĞİL** (#455). İki hata
  #450'nin testlerinden GEÇMİŞTİ ve ancak sayfa tarayıcıda okunurken görüldü: bir fiil
  tekrarı ("ileterek iletebilirsiniz") ve `metadata.title`'ın h1 ile uyuşmaması — sayfa
  artık bir aydınlatma metniydi ama sekme ve arama sonucu bunu söylemiyordu. Metin
  testleri bu boşluğu kapatmaz; **public hukuki metinler gözle de okunmalı**.
- **⚠️ Bu metin hukuki danışmanlık yerine geçmez**; şirkete özel kısım bir hukukçu
  tarafından gözden geçirilmeli.

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

#### ⚠️ Sertifika TAKIM işini gösterir — katkı BİREYSEL ölçülür (#449)

`getStudentCertificate` ve `verifyCertificate` yalnız `assignedProjects` ve
`mentorAssignments` okuyordu. Takım atamasında `studentProfileId` NULL (#332) ve takım
mentörü `TeamMentor`'da — yani **tüm işini takımda yapmış bir mezunun belgesi
"geçerlidir" deyip HİÇBİR iş göstermiyordu**. Canlıda üretildi: mentör yerine yedek
metin ("Posinowa Mentorluk Ekibi"), proje bölümü hiç yok. Eksik değil, **yanıltıcı**.

Takım körlüğünün **altıncı** örneği (#367/#370/#376/#393/#442). Niyet zaten bu dosyada
yazılıydı (#332: "Katkı `assigneeId` + `StepStatusHistory.changedById` üzerinden
ölçülür"), uygulama yoktu.

- **Kural TEK modülde**: `certificate/server/katki.ts`. İki fonksiyon aynı belgeyi iki
  kez derliyordu ve #449 tam olarak bu ikiliğin sonucuydu; ayrıca ikisinin FARKLI belge
  göstermesi doğrulamanın anlamını yok ederdi.
- **⚠️ TAKIMDA SAYI ÖĞRENCİNİN KENDİ KATKISI**, takımın toplamı değil. İki sinyal
  birden: `assigneeId` (üstlenen) **VEYA** `changedById` (tamamlayan). Yalnız ilkine
  bakmak üstlenmeden bitirilen işi, yalnız ikincisine bakmak geçmiş kaydı tutulmadan
  önceki işi kaybederdi. **Bilinen bedel**: başkasının işini "tamamlandı" işaretleyene
  de sayılır — panonun sözleşmesi işi yapanın kapatması, ve gerçekten çalışmış
  stajyerin belgesini boşaltmak daha kötü bir hata olurdu.
- **Takım projesi belgede İŞARETLİ** (`takimAdi`); bireysel işmiş gibi durmuyor.
  **Katkısı SIFIR olan takım projesi listelenmez** — belge, öğrencinin hiç dokunmadığı
  işi kendi projesi gibi göstermemeli. Bireysel projede böyle eleme YOK ("başlamamış"
  da bir durum).
- **⚠️ `ogrencininAtamalariWhere` BİLEREK KULLANILMADI — bunu "tek kaynağa
  geçirilmemiş" sanıp düzeltmeyin.** O fonksiyon `leftAt: null` süzer ve bir YETKİ
  sorusunu yanıtlar. Sertifika ise "bu kişi NE YAPTI" sorusudur ve #332 `leftAt`'in var
  olma sebebini zaten "katkı geçmişi SERTİFİKANIN dayanağı" diye yazıyor. Yetki
  kuralını buraya uygulamak, şemanın korumak için tasarlandığı durumu düşürürdü:
  takımda çalışıp ayrılan stajyerin emeği belgesinde hiç görünmezdi. Canlıda
  doğrulandı — üye "ayrıldı" işaretlendiğinde belge katkısını KORUYOR.
- **Public yüzeyde PII sorguya girmez** (`epostaDahil: false`): #208'deki "yanıttan
  ayıklama değil, baştan çekmeme" kararı korundu.

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

*Son güncelleme: Eylül 2026 — #437–#458 dalgası: savunma derinliği (#437/#439),
mentörün öğrenci detayında takım projeleri (#442), ofis saati tavanı ve HTTP testleri
(#443), admin listelerinin sayfalanması ve süzmenin sunucuya taşınması (#446/#448,
#452), ilerleme toplamasının veritabanına taşınması (#452), KVKK aydınlatma metni
(#450/#451), sertifikanın takım işini göstermesi (#449), SSE tik sayısının ölçümle
düzeltilmesi (#458)*
