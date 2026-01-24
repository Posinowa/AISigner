
<img width="1280" height="320" alt="aisigner-banner" src="https://github.com/user-attachments/assets/52bd9b7a-6182-48d7-860c-02c8abd5aa33" />


## AISigner

AISigner, stajyer/öğrencilerin kısa bir anketle güçlü yönlerini ve seviyelerini belirleyip uygun mentörle eşleştiren; proje havuzundan uygun bir proje atandıktan sonra AI destekli bir öğrenme yol haritası (roadmap) oluşturan açık kaynak bir platformdur.

## Amaç (MVP)
- Öğrencinin kayıt + anket süreci
- AI ile temel profil çıkarımı (seviye / yatkın alanlar)
- Admin’in mentör ataması
- Mentörün proje havuzundan öğrenciye proje ataması
- AI destekli roadmap üretimi ve adımların onaylanması
- GitHub fork/PR akışına dayalı çalışma düzeni

## Ön Gereksinimler

Projeyi kurmadan önce sisteminizde aşağıdaki yazılımların kurulu olduğundan emin olun:

- **Node.js** (v18 veya üzeri)  
- **npm** (Node.js ile birlikte gelir)  
- **Docker** & **Docker Compose**  
- **Git**



##  Hızlı Kurulum

> 1. `git clone https://github.com/elifgularslan/AISigner.git`  
>    → Projeyi kendi bilgisayarına indir.

> 2. `cd AISigner`  
>    → Proje klasörüne geç.

> 3. `docker compose up -d`  
>    → PostgreSQL veritabanını arka planda başlat.

> 4. `.env` dosyasını oluştur  
>    → Ortam değişkenlerini `.env.example` dosyasına göre tanımla (örnek: `DATABASE_URL`, `NEXTAUTH_SECRET`).

> 5. `npm install`  
>    → Proje bağımlılıklarını yükle (Next.js, Prisma, Argon2 vb.)

> 6. `npx prisma migrate dev --name init`  
>    → Veritabanı tablolarını oluştur ve Prisma Client’i generate et.

> 7. `npm run seed`  
>    → Test kullanıcılarını veritabanına ekle (admin, mentor, öğrenci).

> 8. `npm run dev`  
>    → Uygulamayı başlat (`http://localhost:3000` adresinde çalışır).



---

> **NOT:** Seed sonrası test kullanıcıları
 
> | Rol     | Email               | Şifre           |
> |---------|---------------------|-----------------|
>| Admin   | admin@example.com   | geçici_şifre    |
>| Mentor  | mentor@example.com  | geçici_şifre    |
>| Student | student@example.com | geçici_şifre    |

> Bu kullanıcılarla `/signin` üzerinden giriş yapabilir, yönlendirme ve layout guard’ları test edebilirsin.

---



##  Ana Bağımlılıkların Yüklenmesi

### Tüm package.json bağımlılıklarını yükleyin
```bash
npm install
```
Not: Bu adımı atlarsanız, proje çalışmaz çünkü gerekli kütüphaneler (Next.js, Prisma Client, Argon2 vb.) yüklü olmaz. Komutları çalıştırırken hata alırsınız.

### .env dosyasını düzenle (DATABASE_URL'i ayarla)

```bash 
DATABASE_URL= "YOUR_DATABASE_URL"
NEXT_PUBLIC_APP_URL= YOUR_LOCAL_HOST_URL
AUTH_SECRET= change_me

```


## Database Kurulumu
 
 ### 1. Docker ile PostgreSQL'i Ayağa Kaldır
PostgreSQL veritabanını Docker üzerinden ayağa kaldırmak için:
```bash
docker compose up -d
```
Veri tabanı çalışıyor mu test etmek için:
```bash
 docker compose ps 
```

 Başarılı çıktı:
 ```
NAME          COMMAND                  SERVICE    STATUS      PORTS
aisigner_db   "docker-entrypoint.s…"   postgres   Up 5 seconds   0.0.0.0:5432->5432/tcp
```
### 2. Prismayı başlat

```bash
npx prisma init
```



 ### Schema dosyasını düzenle (models ekle)
 **Mevcut Modeller**

* **User Modeli**
```prisma
 model User {

  id        Int      @id @default(autoincrement())  
  email     String   @unique                        
  name      String?                                 
  password  String  //hashed password
  phone     String?                                 
  role      Role     @default(STUDENT)                 
  createdAt DateTime @default(now())                
  updatedAt DateTime @updatedAt                     
}

enum Role {
  ADMIN
  MENTOR  
  STUDENT
}

```
* **Session Modeli**
```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       Int
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 3. Migration Çalıştır

İlk migration'ı oluştur ve uygula ve Prisma Client'i generate et 
```
npx prisma migrate dev --name init

npx prisma generate

```
### 4. Veritabanını Kontrol Et


* Tablolar oluştu mu?
```
docker exec -it aisigner_db bash -c "psql -U postgres -d aisigner -c '\dt'"

```
 * User tablosu yapısı doğru mu?
```
docker exec -it aisigner_db bash -c "psql -U postgres -d aisigner -c '\d \"User\"'"
```
 **Prisma Studio ile Görsel Test**

 * http://localhost:5555 adresinde web arayüzü açılacak, users tablosunu görebiliyor musun?
 ```
 npx prisma studio
 ```

**Prisma Client dosyalarının oluştuğunu kontrol et**
```
ls node_modules/.prisma/client/
```
**TypeScript tip dosyalarını kontrol et**
```
ls node_modules/@prisma/client/
``` 
### 5. Test Verisi Ekleme

**Otomatik olarak Seed'i çalıştırarak (önerilen yöntem):**
```bash
npm run seed
```
**Ekstra Kontrol: Kullanıcı sayısı**
Seed script’in doğru çalışıp çalışmadığını kontrol etmek için kullanın . Örneğin  sonucu → admin, mentor, student kullanıcıları başarıyla eklenmiş demektir.

```bash
docker exec -it aisigner_db bash -c "psql -U postgres -d aisigner -c 'SELECT COUNT(*) FROM \"User\"'"
```

**Veya Prisma Studio ile görsel olarak**
```
npx prisma studio
```
* +Add record butonuna bas
* verileri gir
* save e bas

**Veya terminalden**
```
docker exec -it aisigner_db psql -U postgres -d aisigner -c "
INSERT INTO \"User\" (email, password, role) 
VALUES ('test@example.com', 'geçici_şifre', 'STUDENT') 
"
``` 
NOT: gerçek projede şifre hashlenmeli

### 6. Eğer Hata Alırsan

1) Docker container'ının çalıştığından emin ol: 
```
docker ps
```
2) .env dosyasındaki DATABASE_URL'i kontrol et
 
3) Önceki migration'ları resetle:
```
 npx prisma migrate reset

```

## Seed Nasıl Çalıştırılır?
🔹 Seed (Örnek Kullanıcıları Ekleme)

- Bu adımlar, Lokal geliştirme sırasında veritabanına hızlıca test edilebilecek 3 örnek kullanıcı eklemek için kullanılır.Seed script’i idempotent çalışır, yani aynı script tekrar tekrar çalıştırıldığında kullanıcılar çoğalmaz.

- Şifreler güvenli şekilde **argon2** ile hashlenir.
- Prisma Client kullanılarak veritabanına bağlantı sağlanır.


**Seed Script Çalıştırma**

Seed’i çalıştırmak için terminalden proje klasöründe şu komutu çalıştır:
```
npm run seed
```

Script çalıştığında terminalde şöyle bir çıktı görürsün:

```
✅ ADMIN user created: admin@example.com
✅ MENTOR user created: mentor@example.com
✅ STUDENT user created: student@example.com
Seed process completed! 3 users added!
```

## Kimlik Doğrulama (NextAuth)

Bu projede kimlik doğrulama altyapısı NextAuth ile kurulmuştur. Prisma adapter kullanılarak session verileri veritabanında saklanır. Cookie ayarları `SameSite=Lax` olarak tanımlanmıştır.

Dosya: `src/lib/auth/nextauth.ts`

## Healthcheck
 Veritabanı bağlantısını test etmek için:
 
*Tarayıcıda*: `http://localhost:3000/api/health`

 veya

*Terminalde*:
```
curl http://localhost:3000/api/health
```

**Beklenen çıktı**:
```bash
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2025-09-03T21:44:00.000Z"
}
```
 Eğer veritabanı bağlantısı koparsa, status: "error" ve db: "disconnected" döner.


***GET /api/health***

Bu endpoint `SELECT 1` sorgusu ile bağlantıyı kontrol eder.

- `200 OK` → Bağlantı sağlıklı  
- `500 ERROR` → Bağlantı başarısız

## M2 – Öğrenci Onboarding & Profil Özeti

Bu modül, öğrencinin kayıt sonrası onboarding sürecini ve profil özetini yönetir.

###  *Dosya Yapısı*

- `features/student/ui/OnboardingForm.tsx` → Çok adımlı form bileşeni
- `features/student/models/onboarding.ts` → Zod doğrulama şemaları
- `features/student/server/onboarding.ts` → `saveOnboarding(data)` server action
- `features/student/server/profileSummary.ts` → Mock AI fonksiyonu (`getMockProfileSummary`)
- `features/student/ui/ProfileSummaryCard.tsx` → Profil özeti bileşeni
- `app/(student)/student-dashboard/page.tsx` → Öğrenci dashboard sayfası

###  *Süreç Akışı*

1. Öğrenci `OnboardingForm` üzerinden kişisel bilgilerini, deneyim seviyesini ve hedeflerini girer.
2. Form submit edildiğinde `saveOnboarding()` ile veritabanına `StudentProfile` olarak kaydedilir.
3. Ardından `getMockProfileSummary()` ile sahte AI özeti oluşturulur.
4. Öğrenci `student-dashboard` sayfasına yönlendirilir ve profil özeti + proje durumu gösterilir.

###  M2 – Uygulama Rehberi

Yeni gelen bir geliştirici aşağıdaki adımları izleyerek M2 sürecini uçtan uca test edebilir:

1. `npm run dev` ile projeyi başlat
2. http://localhost:3000/signin üzerinden test kullanıcısı ile giriş yap:
   - E-posta: `student@example.com`
   - Şifre: `geçici_şifre`

3. Oturum açıldıktan sonra http://localhost:3000/student-onboarding  sayfasına git.
4. Formu 3 adımda doldur:
   - Kişisel Bilgiler
   - Deneyim Seviyesi
   - Öğrenme Hedefleri
5. “Gönder” butonuna basıldığında veriler veritabanına kaydedilir (`StudentProfile`)
6. Ardından `student-dashboard` sayfasına yönlendirilirsin
7. Dashboard’da:
   - Hoşgeldin mesajı
   - Profil özeti (mock AI ile)
   - Proje durumu (“Henüz proje atanmadı” mesajı)


Onboarding sonrası veriyi doğrulamak için ``` npx prisma studio```  komutuyla veritabanını görsel olarak inceleyebilirsiniz.


### **Mock AI Notu**

>`getMockProfileSummary()` fonksiyonu şu an sahte veri döndürmektedir. İleride gerçek OpenAI entegrasyonu ile kolayca değiştirilebilir.

---



## Roller (özet)
- **Admin**: Kayıtlı kullanıcıları görür, mentör atar, proje şablonlarını yönetir.
- **Mentör**: Kendisine atanan öğrenciyi görür, proje atar, roadmap’i onaylar/düzenler.
- **Öğrenci**: Anketi doldurur, atanan projeyi ve görevlerini takip eder, fork/PR akışında çalışır.

## Yüksek Seviyeli Akış
1. Öğrenci kayıt olur ve anketi tamamlar.
2. AI, öğrencinin seviyesini ve yatkın alanlarını çıkarır (özet).
3. Admin, uygun mentörü atar.
4. Mentör, proje havuzundan uygun bir proje seçer.
5. AI, proje + öğrenci profiline göre bir roadmap üretir (mentör onaylar/düzenler).
6. Roadmap adımları GitHub issue/PR döngüsü ile yürütülür.

## Teknik (v0)
- **Uygulama**: Next.js 15 (App Router), TypeScript, TailwindCSS
- **Sunucu uçları**: Next.js Route Handlers (REST)
- **Kimlik doğrulama**: (MVP’de belirlenecek — örn. Lucia veya NextAuth)
- **Veritabanı**: PostgreSQL + Prisma
- **AI servisi**: OpenAI-uyumlu bir endpoint (server-side)
- **UI**: shadcn/ui tercih edilebilir

> Not: Bu repo başlangıçta **yalın Next.js iskeleti** içerir. Veritabanı, Prisma, auth, AI ve GitHub entegrasyonları ilk görev(ler) kapsamında eklenecektir.

## Katkı
- Fork → branch → PR akışı ile katkı verin.
- Küçük ve odaklı PR’lar tercih edilir.

## Lisans
MIT

---

## Geliştirme Kuralları ve Mimari İlkeler

**Yaklaşım:** Feature‑based.

```
src/
  app/                         # Next App Router (route segmentleri)
    (public)/                  # kayıt/anket, landing vb.
    (student)/                 # öğrenci alanı
    (mentor)/                  # mentor alanı
    (admin)/                   # admin alanı
    api/                       # (gerekirse) route handlers
  features/
    auth/
      ui/                      # sayfa ve bileşenler (UI-only)
      server/                  # server actions, service, repo katmanı
      models/                  # Zod şemaları, tipler, domain modelleri
      lib/                     # yardımcı fonksiyonlar (yalnızca feature içi)
      hooks/                   # client hooks
      components/              # feature-özel küçük bileşenler
    student/...
    mentor/...
    admin/...
  lib/                         # app-geneli yardımcılar (fetcher, auth guard)
  styles/                      # global css/tailwind
  prisma/
    schema.prisma              # yalnızca veritabanı şeması (Prisma)
```


- **Şemalar (schemas):**
  - **Veritabanı şeması** yalnızca `prisma/schema.prisma` içinde tutulur.
  - **Uygulama/doğrulama şemaları** (Zod) ilgili feature altında `models/` içinde tanımlanır.
- **Dışa Açık API:** Route Handlers → `features/<feature>/server` fonksiyonlarını çağırır. UI bu katmana doğrudan erişmez.
- **İsimlendirme:** Dosya/klsr: kebab-case, React bileşenleri: PascalCase, tip/şema: `PascalCase`, env anahtarları: `SCREAMING_SNAKE_CASE`.
- **İçe Aktarım:** `@/*` alias (mutlak import); feature dışından içeri bağımlılık minimum.
- **Stil/UI:** Tailwind + shadcn/ui. Bileşenler erişilebilirlik (a11y) kurallarına uyar.
- **Durum Yönetimi:** Öncelik server actions; gerekli yerde minimal client state. (İleride React Query opsiyonel.)
- **Güvenlik:** Server-only işlemler Route Handler/Server Action’da kalır; gizli anahtarlar client’a sızmaz. HttpOnly cookie, SameSite=Lax.
- **Kod Kalitesi:** TypeScript strict, ESLint + Prettier zorunlu; küçük ve odaklı PR.
- **Commit/Branch:** Conventional Commits (`feat:`, `fix:`, `chore:`…), branch: `feat/<scope>-kısa-açıklama`.
- **PR Kuralları:** “Ne değişti?” + “Nasıl test edilir?” zorunlu; ekran görüntüsü/gif teşvik edilir.

---
## 📁 Mevcut Proje Yapısı

Uygulama Next.js App Router mimarisiyle yapılandırılmıştır. Dosya sistemi route, rol ve işlev bazlı organize edilmiştir.

```
├── prisma/
│   ├── schema.prisma         # Veritabanı modeli tanımları (User, Session, Role)
│   ├── migrations/           # Prisma migration dosyaları
├── public/                   # Statik dosyalar (favicon, resimler vs.)
├── scripts/
│   └── seed.ts               # Test kullanıcılarını ekleyen seed script
├── src/
│   ├── app/
│   │   ├── (admin)/          # Admin'e özel route grubu
│   │   │   ├── admin-dashboard/
│   │   │   └── layout.tsx    # Admin layout guard (RBAC kontrolü)
│   │   ├── (mentor)/         # Mentör'e özel route grubu
│   │   │   ├── mentor-dashboard/
│   │   │   └── layout.tsx
│   │   ├── (student)/        # Öğrenci'ye özel route grubu
│   │   │   └── layout.tsx
│   │   ├── (auth)/           # Giriş / Kayıt / Çıkış sayfaları
│   │   │   ├── signin/
│   │   │   │   ├── page.tsx      # Giriş formu
│   │   │   │   └── actions.ts    # Giriş işlemi (server action)
│   │   │   ├── signup/
│   │   │   │   ├── page.tsx      # Kayıt formu
│   │   │   │   └── actions.ts    # Kayıt işlemi
│   │   │   ├── signout/
│   │   │   │   └── SignoutButton.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/route.ts  # NextAuth endpoint
│   │   │   ├── health/
│   │   │   │   └── route.ts       # Veritabanı bağlantı kontrolü
│   │   │── debug/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
├── components/
│   ├── DebugNavbar.tsx       # Oturum bilgisi gösteren debug bileşeni
│   └── SessionProvider.tsx   # NextAuth session sağlayıcısı (client context)
├── features/
│   |└── auth/modules/
│   |    └── user.ts           # Auth işlemleri ve Zod şemaları
│   ├── student/ui/
│   │   ├── OnboardingForm.tsx       # Çok adımlı öğrenci onboarding formu
│   │   └── ProfileSummaryCard.tsx   # Profil özeti bileşeni (mock AI çıktısı)
│   ├── student/models/
│   │   └── onboarding.ts           # Zod doğrulama şemaları (kişisel, deneyim, hedef)
│   ├── student/server/
│   │   ├── onboarding.ts           # `saveOnboarding(data)` server action
│   │   └── profileSummary.ts       # `getMockProfileSummary()` fonksiyonu
|
├── lib/
│   ├── auth/
│   │   ├── nextauth.ts       # NextAuth konfigürasyonu
│   │   ├── prisma.ts         # Prisma client instance
│   └── db.ts                 # Alternatif veritabanı erişimi
├── types/
│   └── next-auth.d.ts        # NextAuth tip genişletmeleri (Session, JWT, User)
```
## Genel Roadmap

### M0 – Bootstrap (tamamlandı)
- Next.js 15 + TS + Tailwind iskeleti, README ve lisans.

###  M1 – Altyapı (tamamlandı)

 ***Veritabanı altyapısı***: PostgreSQL (Docker Compose) + Prisma kurulumu  
  - `User` ve `Role` modeli tanımlandı  
  - Prisma singleton (`src/lib/db.ts`) ile bağlantı yönetimi sağlandı

***Seed sistemi***:  
  - `npx prisma db seed` ile 1 admin, 1 mentor, 1 öğrenci oluşturuluyor  
  - Şifreler hashlenmiş (`argon2`) ve veritabanına kaydediliyor  
  - Test kullanıcıları: `admin@example.com`, `mentor@example.com`, `student@example.com`

 ***Kimlik doğrulama (Auth)***:  
  - NextAuth kullanıldı (Lucia önerisi değerlendirildi)  
  - `src/app/api/auth/[...nextauth]/route.ts` içinde yapılandırıldı  
  - Oturum yönetimi: `getServerSession(authOptions)`  
  - Giriş/kayıt akışı tamamlandı

 ***RBAC (Role-Based Access Control)***:  
  - Rol bazlı layout guard’ları: `src/app/(admin|mentor|student)/layout.tsx`  
  - `session.user.role` kontrolü ile yönlendirme sağlanıyor  
  - Giriş yapılmamış kullanıcılar `/signin` sayfasına yönlendiriliyor

   ***Healthcheck endpoint***:  
  - `GET /api/health` → veritabanı bağlantısını kontrol eder  
  - JSON çıktısı: `{ status, db, timestamp }`  
  - README’ye açıklayıcı not eklendi

  ***Hızlı Başlangıç rehberi***:  
  - `git clone → docker compose up -d → .env → migrate → seed → dev` adımları  
  - README’de eksiksiz ve birebir uygulanabilir şekilde belgelendi



### M2 – Öğrenci Onboarding & Profil Özeti (tamamlandı)

***Çok adımlı anket formu***:  
- `features/student/ui/OnboardingForm.tsx` içinde ShadCN bileşenleriyle oluşturuldu  
- Adımlar: Kişisel Bilgiler → Deneyim → Hedefler  
- Doğrulama: `features/student/models/onboarding.ts` içinde Zod şemaları  
- Progress bar ve stepper ile kullanıcı yönlendirmesi sağlandı

***Veri kaydı (Server Action)***:  
- `features/student/server/onboarding.ts` → `saveOnboarding(data)` fonksiyonu  
- `prisma/schema.prisma` → `StudentProfile` modeli: `userId`, `experienceLevel`, `interests`, `goals`, `availability`, `birthYear`  
- Idempotent kayıt: aynı kullanıcıya tekrar çalıştırıldığında veri güncellenir  
- Başarılı işlem sonrası redirect: `/app/(student)/student-dashboard`

***Profil özeti (Mock AI)***:  
- `features/student/server/profileSummary.ts` → `getMockProfileSummary()` fonksiyonu  
- Örnek response: `{ level, tracks, summary }`  
- UI: `features/student/ui/ProfileSummaryCard.tsx` bileşeni ile gösterilir  
- Not: Bu mock fonksiyon ileride gerçek OpenAI entegrasyonu ile kolayca değiştirilebilir

***Dashboard entegrasyonu***:  
- `app/(student)/student-dashboard/page.tsx` → Öğrenci verisi veritabanından çekilir  
- Hoşgeldin mesajı, profil özeti ve proje durumu gösterilir  
- Proje henüz atanmadıysa bilgilendirici mesaj render edilir




### M3 – Admin & Mentor Temelleri
- Admin: kullanıcı listesi, rol/mentör atama ekranı.
- Proje Havuzu (Admin): şablon CRUD, markdown editörü, zorluk/track alanları.

### M4 – Proje Atama & Roadmap Üretimi
- Mentor: öğrenci detayında öneri sıralaması ile proje seçimi.
- AI ile roadmap taslağı üret; mentor düzenleyip yayınlar (yalnızca taslak aşaması, görevleştirmeyi sonraya bırakabiliriz).

### M5 – GitHub Akışı Rehberi
- Dokümantasyon: fork → branch → PR akışı, `gh` CLI yönergeleri.
- (Opsiyon) PR/Issue read‑only durumlarını uygulamada göstermek için webhook/cron okuma taslağı.

### M6 – Geri Bildirim ve Görünürlük
- Öğrenci/Mentor yorum alanları (uygulama içi), ilerleme yüzdesi, bildirim taslağı.

### M7 – Stabilizasyon
- CI (lint/typecheck/test/build), e2e test iskeleti, güvenlik/gizlilik gözden geçirme.

> Not: Bu roadmap **yön göstericidir**. Her milestone küçük PR’lara bölünmelidir; detaylı “tasklandırma” issue’larda yapılacaktır.
