# AISigner — Proje Hafızası (CLAUDE.md)

Claude'un (ve yeni geliştiricilerin) projeyi hızla anlaması için. Kaynağı taramadan önce
burayı okuyun. Her madde bir **kural ya da tuzak**; gerekçenin tamamı parantezdeki
issue/PR'da. Bir kuralı "gereksiz" sanıp sadeleştirmeden önce o issue'yu okuyun.

---

## Genel Bakış

**AISigner** — mentör-stajyer eşleştirme ve AI destekli staj/proje yönetim platformu.

- **Stack**: Next.js 15.5 (App Router), TypeScript strict, Tailwind v4 (tokenlar `globals.css` `@theme`), shadcn/ui
- **Auth**: NextAuth v4, JWT, Credentials, argon2
- **DB**: PostgreSQL + Prisma 6 (migration tabanlı, `db push` YOK)
- **AI**: Vertex AI / Gemini 2.5 Flash (`lib/ai/gemini-client.ts`). Bağlantı testi: `npm run test:ai`
- **Test**: Vitest (`vi.hoisted` mock deseni) + Playwright E2E
- **Validation**: Zod v4 — tüm API şemaları `lib/validations/api.ts`

## Takım Akışı

- Depo `Posinowa/AISigner`, **default branch `develop`**; `main` yalnız `release/*` PR'ı alır.
- **1 issue = 1 PR.** Dal: `<type>/issue-<no>-<kısa-başlık>`; PR başlığı `feat:`/`fix:`/...;
  body'de `Closes #N` zorunlu. PR Guard denetler, yasak dosyalar (`.env`, `*.pem`,
  `gcp-credentials.json`) FAIL eder. Ayrıntı: `CONTRIBUTING.md`.
- Dependabot PR'ları yalnız sözleşme adımından muaf, yasak dosya denetimi herkeste (#476).

### ⚠️ CI tuzakları
- CI **Node 22 / npm 10**. Lockfile'a dokunan her işlem **`npx -y npm@10 install ...`** ile —
  npm 11 lockfile'ı `npm ci`'da EUSAGE verir (esbuild/@emnapi girdileri).
- **`engine-strict=true`** (`.npmrc`): uyumsuz `engines.node` kurulumu kırar. Yükseltme
  `npm ci`'da patlıyorsa önce `engines`'e bakın (#483).
- Native binding'li paketlerde Linux binary'leri lockfile'da çözülmüş olmalı.
- `npm audit --omit=dev --audit-level=high` CI'da **bloke eder** (#469). `npm audit fix --force`
  KULLANMAYIN — next-auth'u 1.x'e düşürür; sürümü `overrides`'ta elle yükseltin (#545).

## Klasör Yapısı (özet)

```
src/app/        (admin) (auth) (mentor) (student) account-status/ terms|privacy/
                verify-certificate/[no]/  api/
src/features/   admin ai certificate kvkk legal messaging mentors ofis-saati progress
                projects proposals radar roadmap student suggestions survey bildirim ...
src/lib/        ai/ auth/(guard, nextauth, mentor-access, hesap-durumu, *-token)
                validations/api.ts rate-limit.ts client-ip.ts security-headers.ts
                mail.ts tarih.ts file-signature.ts storage/ logger.ts
```

Tek doğru kaynak modüller — **aynı mantığı ikinci kez yazmayın, bunlardan geçin**:

| Soru | Modül |
|---|---|
| Bu atama kimin / bu öğrenci benim mi? | `teams/server/sahiplik.ts` (`mentorunOgrencisiWhere`, `ogrencininAtamalariWhere`) |
| Aynısı ham SQL'de | `teams/server/sahiplik-sql.ts` (#376) |
| Hangi adımdayım / kilitli mi? | `roadmap/odak.ts` (#416) |
| Adım sırası | `roadmap/server/siralama.ts` (#406) |
| İlerleme + duraklama | `progress/ilerleme.ts` (#432) |
| AI rızası var mı? | `kvkk/riza.ts` `atamaninAiRizasiVar()` (#389) |
| Hesap durumu ekranı | `lib/auth/hesap-durumu.ts` (#466) |
| Tarih/saat biçimi | `lib/tarih.ts` (#460) |
| Sertifika katkısı | `certificate/server/katki.ts` (#449) |
| Admin kategorileri | `admin/kategoriler.ts` (#448) |
| AI üretim kökeni | `lib/ai/uretim-kokeni.ts` (#497) |

İstemci bileşenlerinin kullandığı sabit/etiket modülleri **Prisma import etmez**
(`server-only` dışında tutulur) — sunucu kodu istemci paketine sürüklenmesin (#432/#448).

## Veritabanı (özet)

Otoriter tanım `prisma/schema.prisma`. Öne çıkanlar:

- `User.accountStatus`: PENDING / APPROVED / REJECTED / GRADUATED (#38, #208)
- `MentorAssignment`: öğrenci↔mentör **M:N**, mentörler eşit yetkili (#195)
- `AssignedProject`: bireysel (`studentProfileId`) **veya** takım (`teamId`) — sahip **tam biri**,
  kısıt veritabanında ham CHECK (`assigned_project_sahip_tek`) (#332). `tekilKey @unique`
  tekrarlanamaz şablonda dolu, tekrarlanabilirde NULL (#503)
- **Koşullu tekillik deseni** `pendingKey @unique` (bekleyende dolu, kararda NULL):
  `WorkspaceRequest` (#349), `ProjectProposal` (#366). Kısmi indeks Prisma'da ifade edilemiyor.
- `StepStatusHistory` (#324): durum geçişleri + gerekçe (revizyon notu burada, adımda değil)
- `ProcessedWebhook` / `PullRequestReview`: webhook ve AI inceleme idempotensi (#326/#327)
- `OfisSaatiSlotu` `@@unique([mentorId, baslangic])` (#398) · `TypingSignal` `@@id([from,to])` (#354)
- `Notification` kalıcı bildirimler (#380) · `RateLimit` sayaçlar (#322)

### Migration güvenliği (#198)
Yıkıcı değişiklik (kolon/tablo silme, rename, NOT NULL) tek deploy'da YAPILMAZ —
expand/contract. Kural: `CONTRIBUTING.md` → *Migration Güvenliği*. **Uygulanmış migration
dosyalarını düzenlemeyin** (yorum dahil) — Prisma checksum'ı değişir.

---

## Kritik Sözleşmeler

### Auth ve onay
- JWT callback rol + `accountStatus`'u **her istekte DB'den tazeler** (#44).
- **Oturum çerezinin adını ELLE VERMEYİN** (#308 — canlıyı kırdı): middleware `getToken()`
  kullanıyor, NextAuth adı `NEXTAUTH_URL`'e göre seçer (https ⇒ `__Secure-`). Regresyon
  testi `nextauth.test.ts` + E2E (#505).
- **Rol yoksa 401** (silinmiş kullanıcı), rol istensin istenmesin (#391). `allowUnapprovedStudent`
  bu kapıyı açmaz.
- **API rotaları yönlendirilmez**, 401/403 JSON döner — middleware'de `/api/` kontrolü tüm
  yönlendirmelerden ÖNCE (#375). Yanıtlar `middleware.ts` sarmalayıcısından geçer (#493).
- **E-posta doğrulaması APPROVED'un ön koşulu**, girişin değil (#310).
- Rate-limit IP'si **sağdan** okunur: `lib/client-ip.ts`, `TRUSTED_PROXY_HOPS` (#308).
  Başlığı doğrudan okumayın.
- **⚠️ PENDING profil-tamamlama istisnası (#143 — bozmayın):** stajyer PENDING iken profilini
  tamamlar, onay sonra gelir. Bu uçlar `requireAuth(role, { allowUnapprovedStudent: true })`
  kullanır (PENDING geçer, REJECTED 403). `saveOnboarding` da artık bu seçenekle korunuyor
  (#439). Middleware: PENDING yalnız `/profile-setup` + `/student-onboarding`. Bu uçlara
  "güvenlik sıkılaştırması" diye düz `requireAuth` eklemek onboarding'i çökertir.

### Yetki
- "Yetkisiz" de **404** döner — başkasının kaydının var olduğu sızmasın (#379, #398, #411).
- URL'den iki kimlik alan uçta **ikisinin bağı sorulur**: `where: { id: stepId, roadmapId }` (#411).
- `Prisma.raw` parametreleştirmez — yalnız kod içi sabit (#439). Depolama adı yol kaçışına
  karşı **fırlatır**, kırpmaz (#439).

### ⚠️ Takım körlüğü (#332 — yedi kez tekrarladı)
Takım atamasında `studentProfileId` **NULL**. "Öğrencinin projeleri" / "mentörün
öğrencileri" sorusu **iki yoldan** sorulmalı: bireysel bağ **ve** takım (`TeamMember`/
`TeamMentor`). Tek yola bakan sorgu takım işini **sessizce** düşürür — listede, sayaçta,
detay sayfasında, sertifikada, AI önerisinde, ham SQL'de ayrı ayrı yaşandı
(#367/#370/#376/#393/#442/#449/#498). Yeni sorgu yazmayın, `sahiplik.ts`'ten geçin.
- Takım panosunda **yazma** yalnız takım mentörü (`mentoruMu`), **okuma** üyenin kişisel
  mentörüne de açık (`erisebilirMi`) (#434). `ATAMA_SAHIPLIK_SELECT` alanları tipte ZORUNLU.
- Ayrılmış üye sahip değil ama satırı silinmez (`leftAt`) — **katkı geçmişi sertifikanın
  dayanağı**. Sertifika bu yüzden `ogrencininAtamalariWhere` (yetki sorusu, `leftAt: null`)
  KULLANMAZ (#449). AI önerisi ise ayrılmış takımı kapsam dışı sayar (#498).
- Takımda: AI seviye EN DÜŞÜK, PR incelemesinde HERKESİN rızası, günlük tavan takım başına;
  **AI yol haritası üretimi yok** (açık 400).
- Sayaçlar proje başına sayar, öğrenci başına değil (#393). Kapasite/yük sayımında mezun ve
  reddedilen sayılmaz; dolu mentör/proje **engellenmez**, yalnız gösterilir (#404/#499).

### Mezun (GRADUATED) (#208)
- **Kapalı:** sistem durumunu değiştiren uçlar (adım, dosya, yorum, üstlenme, proje önerisi)
  ve ücretli AI (chat, ai-step). **Açık (bilerek):** insan iletişimi — mesajlaşma, öneri/istek,
  ofis saati rezervasyonu. Bunları "eksik kapı" sanıp kapatmayın.
- Sertifika **yalnız mezuniyette** resmileşir (`ensureCertificateIssued` → `certificateNumber`
  + `issuedAt`). `updateCertificateDetails` `issuedAt` YAZMAZ.
- Public doğrulama: rate-limit `getVerification` içinde (metadata sayfadan önce çalışır),
  `robots: noindex`, PII sorguya hiç girmez.

### AI
- **Her kullanıcı metni `veriBlogu`/`guvenliMetin`/`guvenliListe` ile sarılır** (#390) — mentör
  metni, şablon başlığı, `interests`/`expertise` dahil (#437). "Yetkili kişi yazdı" muafiyet değil.
- **Her AI çıktısı `cozVeDogrula`'dan geçer** (#377); elle `JSON.parse`/regex yok. Şema sayıları
  da sınırlar, boş liste reddedilir (#410).
- Vertex yapılandırılmamışsa analiz/özet **mock'a düşer**, chat hata döner. Yedek çıktının
  kökeni `null` yazılır; `eskiSurumMu(null)` FALSE; yedek kökenli analiz eşleştirmeye girmez (#497/#501).
- **Rıza** `atamaninAiRizasiVar()` ile (#389); takımda herkesinki. Rıza yoksa GitHub kurulumu
  AI'sız sürer, `ai-step` açık 403 verir. Kapsamı genişleyen özellik `guncelRizaVar` +
  `RIZA_METIN_SURUMU` artışı ister (#327). Rıza geri alınınca türev analizler **senkron** silinir (#352).
- Yol haritası girdileri: `ProfileAnalysis` + geçmiş adım başlıkları + mentör yönlendirmesi;
  **mentör yönlendirmesi analizden önceliklidir** ve prompt'ta açıkça yazılı (#410/#423).
- **Skor yok, sinyal var**: yüzde uyum/risk üretilmez — bant + gerekçe ya da verinin kendisi
  ("14 gündür sessiz") (#328/#331/#397/#432). Mentörleri karşılaştıran sıralama yok.
- AI kod incelemesinde **mock fallback YOK** — public PR'a yazılıyor (#327).

### GitHub
- **Taramaya değil kayda güven** — GitHub liste uçları anında tutarlı değil; idempotens
  veritabanında (`StepIssue.githubIssueUrl`, `PullRequestReview`, `pendingKey`) (#345).
- Hesap türü **sorulur**, tahmin edilmez; kişisel hesap yalnız token sahibininki (#346).
- Kurulum: mentör talep eder, admin onaylar; atomik `PROVISIONING` kilidi atlanmaz (#349/#318).
- `githubStatus: LINKED` (BAGLA) = depo var ama biz kurmadık: kurulum kilidi onu da dışlar,
  **webhook ve AI inceleme çalışmaz** (#366). Devri platform başlatamaz, yalnız tespit eder.
- Webhook `reopened` yalnız `COMPLETED`'ı geri çeker — kendi revizyon olayımızı ezmesin (#378).
  Revizyonda merge edilmiş iş için yeni issue, edilmemişse yeniden aç; GitHub hatası revizyonu
  geri almaz (#379). `ProcessedWebhook` 7 günlük fırsatçı temizlik (#378).

### Mentör onay kapısı (#379)
Yalnız tek geçiş açık: `COMPLETED → REVISION_REQUESTED`, gerekçe ≥10 karakter
(`StepStatusHistory.note`). Mentör ucu `status`'u hâlâ kabul etmez. Öğrenci yeniden
başlatabilir, doğrudan tamamlayamaz. Proje `COMPLETED` kalmaz.

### Gerçek zamanlı (#329/#354/#380)
- SSE, **sunucu tarafı tarama**: pod başına tik başına ~5 sorgu, **kullanıcı sayısından
  bağımsız** (#458). Yeni olay türü eklenirse bu rakamı güncelleyin.
- Süreç belleğinde durum YOK (çok instance). Yoklama koşullu yedek olarak kalır.
- Bağlantı sekme başına tek (`useCanliAkis`, referans sayacı; testte `canliAkisiSifirlaForTests()`).
- Bildirim **hiç fırlatmaz**; e-posta gitmese de satır düşer, satır düşmezse e-posta gitmez.
  E-posta listesi dar (hesap kararı, mentör ataması, öneri/çalışma alanı kararı).

### Veri ve performans
- Toplama **veritabanında** (#313/#331/#452); satırları JS'e çekip gruplamayın.
- Sayfalanan listede arama, filtre ve sayaçların üçü de **sunucuda** (#448). Sayaçlar durum
  süzgecini almaz, mentör süzgecini alır (#452). Sıralama iki alanlı (`createdAt, id`).
- Sıra her yazmada 1..n yeniden numaralanır, tek `$transaction` (#406).
- Çift rezervasyon / çift açma veritabanında engellenir (koşullu UPDATE, `@@unique`) (#398).
- Ölçümü dev modunda ya da build sürerken yapmayın.

### Tarih ve saat (#460)
`lib/tarih.ts` her çağrıda `timeZone: "Europe/Istanbul"` verir ve çağıran **ezemez**.
`toLocaleDateString` doğrudan çağrılmaz. Saat UTC saklanır; dilim hesabı epoch aritmetiği.
**Saat testleri sürecin dilimini değiştirir** — geliştirme makinesi UTC+3 olduğundan hatalı
kod aksi halde geçer.

### Altyapı
- `rate-limit.ts` **asenkron**, sayaçlar DB'de, atomik; DB yoksa fail-open (#322).
- `mail.ts` yapılandırma yoksa ÇÖKMEZ (#241). Dosya depolama `GCS_BUCKET` varsa GCS, yoksa
  disk; indirme **proxy** (per-request yetki) (#197). Upload magic-byte doğrulamalı (#113).
- İstek kimliği dışarıdan gelirse doğrulanır; bildirim imzasına girmez (#493).
- Sentry yalnız sunucu, `SENTRY_DSN` **ve** `kvkk.ts` `HATA_TESHIS` şart (#519).
- KVKK `/privacy`: şirket bilgileri `features/legal/kvkk.ts`'teki `null`'lar doldurulunca
  yayımlanır; çerez paragrafı koddan çıkarıldı ve testle metne bağlı (#450).
- Üretim CSP'sinde `'unsafe-eval'` yok; `'unsafe-inline'` hydration için bilerek var (#310).

## Tasarım Sistemi

- slate nötr, blue-600/indigo-600 primary, emerald başarı, amber uyarı, red hata
- Kart: `bg-white rounded-2xl border border-slate-200/80 shadow-sm`; gradient header
  `from-blue-500 via-indigo-500 to-purple-500`
- Rol renkleri tek kaynakta (`lib/ui/rol-renkleri.ts`)
- Hata ≠ boş: `loadError` + yeniden dene (sessizce boş liste yok). Uyarı engelleyici değilse
  sonucunu da söyle (#405). Toast: `sonner` (`alert()` yok)

## Komutlar

```bash
npm run dev | build | lint | typecheck | test | test:e2e
npm run seed               # idempotent demo verisi (üretimde çalışmaz)
npm run create:admin       # ilk yönetici (ADMIN_EMAIL + ADMIN_PASSWORD)
npm run check:migrations   # yıkıcı migration guard (CI'da zorunlu)
npm run test:ai            # Vertex AI bağlantısı (.env gerekli)
npx prisma migrate dev --name <ad>
docker compose up -d db
```

## Dağıtım (özet — ayrıntı `DEPLOYMENT.md`)

- Docker imajı **standalone**; runner'da `npm install` yok, entrypoint migration + `node server.js`.
- `AUTH_SECRET` tek sır — **`NEXTAUTH_SECRET` YOK**. Oturum, e-posta doğrulama ve şifre
  sıfırlama aynı sırla imzalanır; rotasyon hepsini geçersiz kılar.
- `NEXT_PUBLIC_APP_URL` **derleme anında** gömülür (build-arg) (#392).
- `TRUSTED_PROXY_HOPS` platformun vekil sayısıyla uyuşmalı — `DEPLOYMENT.md §7` ile ölçün.
- Cloud Run: anahtar dosyası değil ADC, `--no-cpu-throttling`, `--min-instances=1`,
  `HOSTNAME` tanımlanmaz (`DEPLOYMENT.md §11`).
