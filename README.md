
<img width="1280" height="320" alt="aisigner-banner" src="https://github.com/user-attachments/assets/52bd9b7a-6182-48d7-860c-02c8abd5aa33" />

## AISigner

AISigner, stajyerleri uygun mentörle eşleştiren ve staj sürecini yapay zekâ
desteğiyle yöneten açık kaynak bir platformdur. Stajyerin profili analiz edilir,
ona uygun bir proje atanır, proje için kişiye özel bir öğrenme yol haritası
üretilir ve iş, GitHub üzerinde gerçek bir depo, issue ve PR döngüsüyle yürütülür.

## Özellikler

- **Profil analizi ve eşleştirme** — stajyer anketinden seviye ve ilgi alanı
  çıkarımı; admin'e gerekçeli mentör önerisi (atama kararı insanda kalır)
- **AI yol haritası** — projeye ve stajyere göre adım adım plan; mentör düzenler,
  sıralar ve yayınlar
- **GitHub çalışma alanı** — mentör talep eder, admin onaylar; depo, milestone ve
  issue'lar otomatik açılır. Webhook ile issue/PR durumu panoya yansır
- **AI kod incelemesi** — PR açıldığında ön inceleme yorumu (açık rıza şartıyla)
- **Mentör onay kapısı** — tamamlanan adım gerekçeyle revizyona döndürülebilir
- **Takım projeleri** — 2–4 kişilik takımlar ortak pano ve ortak depo kullanır
- **Gerçek zamanlı mesajlaşma**, kalıcı bildirimler ve 1-e-1 mentör görüşmesi takvimi
- **Mentör ve yönetici analitiği** — darboğaz, sessiz kalan stajyer, yanıt süresi
- **Doğrulanabilir sertifika** — mezuniyette QR'lı, herkese açık doğrulama sayfası
- **KVKK** — yurt dışına AI aktarımı için açık rıza; rıza geri alınınca türev veriler silinir

Roller: **Admin** (onay, atama, şablon havuzu) · **Mentör** (öğrenci, yol haritası,
inceleme) · **Stajyer** (profil, adımlar, teslim).

## Teknoloji

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 + shadcn/ui · PostgreSQL +
Prisma · NextAuth v4 (JWT) · Google Vertex AI (Gemini) · Vitest + Playwright

## Hızlı Kurulum

**Gereksinimler:** Node.js 22+, Docker (Compose ile), Git.

```bash
git clone https://github.com/Posinowa/AISigner.git
cd AISigner

docker compose up -d db          # yalnız PostgreSQL
cp .env.example .env             # DATABASE_URL ve AUTH_SECRET'ı doldurun
npm install
npx prisma migrate deploy        # hazır migration'ları uygular
npm run seed                     # demo kullanıcılar ve proje şablonları
npm run dev                      # http://localhost:3000
```

> `AUTH_SECRET` tek sırdır (`openssl rand -base64 32`); `NEXTAUTH_SECRET` diye bir
> değişken **yoktur**. `.env` dosyasındaki diğer alanlar isteğe bağlıdır:
> Vertex AI tanımlı değilse analiz ve öneriler örnek içeriğe düşer (AI sohbeti çalışmaz),
> SMTP tanımlı değilse e-postalar gönderilmez, `GITHUB_TOKEN` yoksa GitHub işlemleri
> simüle edilir. Ayrıntı: [DEPLOYMENT.md](DEPLOYMENT.md) §2.

### Demo hesapları

`npm run seed` şu hesapları oluşturur (şifre: `geçici_şifre`, ya da `DEMO_PASSWORD`
ile verdiğiniz değer):

| Rol | E-posta |
|---|---|
| Admin | `admin@example.com` |
| Mentör | `mentor@example.com` |
| Stajyer | `student@example.com` |

Seed idempotenttir; tekrar çalıştırmak demo hesapları tazeler, kopya üretmez.
**Üretimde çalışmaz** — canlıda ilk yönetici `npm run create:admin` ile oluşturulur.

### Sorun giderme

- **Veritabanı ayakta mı?** `docker compose ps` · `curl localhost:3000/api/health`
  → `{"status":"ok","db":"connected"}`
- **Veriye göz atmak:** `npx prisma studio` (`http://localhost:5555`)
- **Şema uyuşmazlığı (yalnız lokal, veriyi siler):** `npx prisma migrate reset`

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` / `build` / `start` | Geliştirme sunucusu / üretim derlemesi / üretim sunucusu |
| `npm test` | Birim ve entegrasyon testleri (Vitest) |
| `npm run test:e2e` | Uçtan uca testler (Playwright) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript kontrolü |
| `npm run check:migrations` | Yıkıcı migration kontrolü (CI'da zorunlu) |
| `npm run seed` | Demo verisi (yalnız geliştirme) |
| `npm run create:admin` | İlk yöneticiyi ortam değişkenlerinden oluşturur |
| `npm run test:ai` | Vertex AI bağlantı testi |

Şema değişikliği için `npx prisma migrate dev --name <ad>` kullanın (`db push` değil).

## Belgeler

| Belge | İçerik |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dal ve PR akışı, kod standartları, migration güvenliği |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Ortam değişkenleri, Docker, Out Plane, Google Cloud Run, yedekleme, canlıya alma listesi |
| [CLAUDE.md](CLAUDE.md) | Mimari kararlar ve bozulmaması gereken sözleşmeler |

Veritabanı modellerinin otoriter tanımı [`prisma/schema.prisma`](prisma/schema.prisma).

## Katkı

Katkılar memnuniyetle karşılanır. Her iş bir issue ile başlar, her PR tek bir issue'yu
kapatır; ayrıntılar [CONTRIBUTING.md](CONTRIBUTING.md)'de.

## Lisans

[MIT](LICENSE) © POSINOWA
