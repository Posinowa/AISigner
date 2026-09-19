# AISigner'a Katkıda Bulunma Rehberi

AISigner'a katkıda bulunmak istediğiniz için teşekkür ederiz! Bu belge, katkı sürecini kolaylaştırmak için gerekli bilgileri içerir.

## Başlamadan Önce

1. Projeyi fork edin
2. Kendi fork'unuzdan bir branch oluşturun
3. Yerel ortamınızı kurun (bkz. [README.md](README.md))

## Geliştirme Ortamı Kurulumu

```bash
# 1. Fork'unuzu klonlayın
git clone https://github.com/<kullanici-adiniz>/AISigner.git
cd AISigner

# 2. PostgreSQL'i başlatın (yalnız veritabanı; `up -d` uygulama imajını da derler)
docker compose up -d db

# 3. Bağımlılıkları yükleyin
npm install

# 4. .env dosyasını oluşturun
cp .env.example .env
# .env dosyasını düzenleyin

# 5. Veritabanını hazırlayın (hazır migration'lar; `migrate dev` yeni şema değişikliği içindir)
npx prisma migrate deploy
npm run seed

# 6. Geliştirme sunucusunu başlatın
npm run dev
```

## Branch Workflow

Bu projede `develop` geliştirme branch'i, `main` production branch'i olarak kullanılır.

- Günlük geliştirme PR'ları `develop` branch'ine açılır.
- `main` branch'ine yalnızca release PR açılır.
- `main` ve `develop` branch'lerine doğrudan push yapılmamalıdır.
- Her çalışma bir GitHub issue ile başlamalıdır.
- Her PR yalnızca bir net issue kapsamını çözmelidir.

### Organizasyon İçindeki Geliştirici Akışı

1. GitHub Issues üzerinden bir issue seçin veya yeni issue açın.
2. Lokal `develop` branch'inizi güncelleyin:

```bash
git checkout develop
git pull origin develop
```

3. Issue numarasını içeren bir branch oluşturun:

```bash
git checkout -b feature/issue-38-intern-approval-status
```

4. Değişiklikleri yapın, local kontrolleri çalıştırın:

```bash
npm run lint
npm test
npm run build
```

5. Branch'i remote'a push edin:

```bash
git push -u origin feature/issue-38-intern-approval-status
```

6. GitHub üzerinden `develop` hedefli PR açın.
7. PR açıklamasında issue'yu kapatacak ifadeyi ekleyin:

```md
Closes #38
```

8. CI ve PR Guard kontrolleri geçtikten sonra review isteyin.

### Branch İsimlendirme Standardı

Branch adı şu formata uymalıdır:

```text
<type>/issue-<issueNumber>-<short-title>
```

Geçerli type değerleri:

```text
feature
fix
chore
refactor
ci
docs
```

Geçerli örnekler:

```text
feature/issue-38-intern-approval-status
fix/issue-42-forgot-password-public-route
chore/issue-56-demo-seed-data
refactor/issue-22-clean-auth-guards
ci/issue-53-github-actions-ci
docs/issue-57-update-setup-docs
```

Geçersiz örnekler:

```text
test
furkan
new-branch
update
final
frontend-fixes
feat/auth-social-login
fix/signup-validation-bug
```

PR Guard'ın beklediği regex:

```text
^(feature|fix|chore|refactor|ci|docs)/issue-[0-9]+-[a-z0-9-]+$
```

## Commit Mesajları

[Conventional Commits](https://www.conventionalcommits.org/) standardını kullanıyoruz:

```
feat: öğrenci dashboard'una ilerleme grafiği ekle
fix: signup formundaki lastName doğrulama hatası düzelt
docs: API endpoint dokümantasyonu güncelle
chore: kullanılmayan bağımlılıkları kaldır
refactor: prisma client singleton'ı birleştir
```

## Pull Request Süreci

### PR Açmadan Önce
- [ ] Kodunuz lint kontrolünden geçiyor: `npm run lint`
- [ ] Build başarıyla tamamlanıyor: `npm run build`
- [ ] Testler geçiyor: `npm test`
- [ ] İlgili migration varsa eklenmiş — ve **yıkıcı** (drop/rename/NOT NULL) ise
      expand/contract'a bölünmüş: `npm run check:migrations` yeşil (bkz. aşağıdaki *Migration Güvenliği* bölümü)
- [ ] Gereksiz dosya değişikliği yok
- [ ] `.env`, private key veya service account dosyası commit edilmedi

### PR Açarken
1. PR hedef branch'i normal geliştirme işleri için `develop` olmalı.
2. `main` hedefli PR yalnızca `release/*` branch'inden açılmalı.
3. PR başlığı şu formatlardan biriyle başlamalı:

```text
feat: ...
fix: ...
chore: ...
refactor: ...
ci: ...
docs: ...
```

4. PR açıklamasındaki `Related Issue` bölümünde issue kapatma ifadesi bulunmalı:

```md
Closes #38
```

Alternatif olarak şunlar da kabul edilir:

```md
Fixes #38
Resolves #38
```

5. PR açıklamasında şu bilgiler net olmalı:
   - **Summary:** PR ne yapıyor?
   - **Changes:** Hangi ana değişiklikler yapıldı?
   - **Screenshots:** UI değişikliği varsa ekran görüntüsü
   - **Reviewer Notes:** Reviewer'ın özellikle bakması gereken yerler

6. **Etiketler:** PR açarken bağlı issue'nun etiketlerini PR'a da ekleyin —
   **en az `type:` ve `priority:`**, mümkünse `area:` de. Böylece PR listesi
   issue'lar gibi filtrelenebilir ve önceliklendirme tek bakışta görünür.

   ```bash
   # PR açarken doğrudan:
   gh pr create --label "type:fix,priority:P1,area:auth" ...

   # Açtıktan sonra eklemek için:
   gh pr edit <pr-no> --add-label "type:fix,priority:P1"
   ```

### Issue Kapatma Standardı

Issue'nun PR merge edildiğinde otomatik kapanması için PR body içinde şu ifadelerden biri bulunmalıdır:

```md
Closes #issueNumber
Fixes #issueNumber
Resolves #issueNumber
```

Örnek:

```md
Closes #42
```

Sadece aşağıdaki gibi referans vermek issue'yu otomatik kapatmaz:

```md
Related #42
See #42
Issue #42
```

### PR Guard Neleri Kontrol Eder?

PR Guard aşağıdaki durumlarda PR'ı fail eder:

- PR başlığı `feat:`, `fix:`, `chore:`, `refactor:`, `ci:` veya `docs:` ile başlamıyorsa
- `develop` hedefli PR branch adı standart regex'e uymuyorsa
- `main` hedefli PR `release/*` branch'inden gelmiyorsa
- PR body içinde `Closes #`, `Fixes #` veya `Resolves #` yoksa
- Forbidden dosya commit edildiyse:
  - `.env`
  - `.env.local`
  - `.env.production`
  - `*.pem`
  - `*.key`
  - `credentials.json`
  - `serviceAccount.json`
  - `service-account.json`
  - `gcp-credentials.json`

PR Guard aşağıdaki durumlarda warning verir, doğrudan fail etmez:

- Değişen dosya sayısı 20'den fazlaysa
- Değişen satır sayısı 800'den fazlaysa
- Lock file değiştiyse:
  - `package-lock.json`
  - `pnpm-lock.yaml`
  - `yarn.lock`
- Migration dosyası değiştiyse
- GitHub workflow dosyası değiştiyse
- Firebase veya Supabase config benzeri dosyalar değiştiyse

Bu warning'ler otomatik olarak PR'ı engellemez; reviewer'ın özellikle kontrol etmesi gereken alanları gösterir.

### PR İnceleme
- En az 1 maintainer onayı gereklidir
- Küçük ve odaklı PR'lar tercih edilir (tek bir özellik veya düzeltme)
- Büyük değişiklikler önce issue'da tartışılmalıdır
- Review comment'leri çözülmeden merge yapılmamalıdır
- CI ve PR Guard kontrolleri geçmeden merge yapılmamalıdır

## Kod Standartları

### Genel
- **TypeScript strict mode** aktiftir
- ESLint kurallarına uyulmalıdır
- Dosya/klasör isimleri: `kebab-case`
- React bileşenleri: `PascalCase`
- Env değişkenleri: `SCREAMING_SNAKE_CASE`

### Proje Yapısı
```
src/
  app/          # Next.js App Router (route segmentleri)
  features/     # Feature-based modüller
    <feature>/
      ui/       # React bileşenleri
      server/   # Server actions, service katmanı
      models/   # Zod şemaları, tipler
  components/   # Paylaşılan UI bileşenleri
  lib/          # App-geneli yardımcılar
```

### İçe Aktarım Kuralları
- `@/*` alias kullanın (mutlak import)
- Feature dışından içeri bağımlılık minimum tutun
- UI bileşenleri doğrudan `server/` katmanına erişmemeli

### Güvenlik
- Gizli anahtarlar sadece sunucu tarafında kullanılmalı
- API route'larında `requireAuth()` guard'ı kullanılmalı
- Kullanıcı girdileri Zod ile doğrulanmalı

## Issue Açma

- Bug report için: sorunu net tanımlayın, tekrar adımlarını yazın
- Feature request için: motivasyonu ve beklenen davranışı açıklayın
- Her issue'da etiket (label) kullanmaya özen gösterin

## Soru & İletişim

Sorularınız için GitHub Issues veya Discussions kullanabilirsiniz.

---

## Migration Güvenliği — expand/contract (#198)

Bu belge, şema göçlerini (Prisma migration) **zero-downtime deploy'u bozmadan** yazmak
içindir. Kısa özet: **yıkıcı değişiklikleri (kolon/tablo silme, rename, NOT NULL) tek bir
deploy'da yapma — faz faz böl.**

> Deploy mekaniği için [DEPLOYMENT.md](DEPLOYMENT.md). Guard: `npm run check:migrations` (CI'da zorunlu).

---

### 1. Neden sorun?

Out Plane (ve çoğu PaaS) **downtime'sız** deploy eder: yeni sürüm ayağa kalkarken **eski
sürüm hâlâ trafik alır**. Konteyner açılışında `docker-entrypoint.sh` → `prisma migrate
deploy` çalışır. Bu migration bir kolonu **drop** ederse, o kısa çakışma penceresinde hâlâ
koşan **eski kod** o kolonu sorgular → **hata**.

Yani şema ile kod **iki farklı sürümde** olabildiği an, şema **her iki koda da uyumlu**
olmalıdır.

---

### 2. Altın kural: expand → migrate → contract

Yıkıcı bir değişikliği **aynı** deploy'da yapma. Üç faza böl (genelde ≥2 ayrı deploy):

| Faz | Ne yapılır | Geriye uyumlu mu? |
|---|---|---|
| **1. Expand** | Yeni kolon/tablo **nullable/additive** eklenir. | ✅ Eski kod yeni alanı görmez, bozulmaz. |
| **2. Migrate** | Veri backfill edilir; kod **hem eskiyi hem yeniyi** yazar/okur (geçiş). | ✅ |
| **3. Contract** | Eski sürüm tamamen gidince, **AYRI bir deploy'da** eski kolon drop edilir. | ✅ Artık kimse kullanmıyor. |

#### Örnekler

- **Kolon ekleme**: her zaman `NULL` veya `DEFAULT` ile ekle. `NOT NULL` gerekiyorsa: (1)
  nullable ekle, (2) backfill, (3) ayrı deploy'da `SET NOT NULL`.
- **Kolon silme**: (1) koddan kullanımını kaldır + deploy, (2) sonraki deploy'da `DROP COLUMN`.
- **Rename**: rename = drop + add. Yeni kolon ekle → çift-yaz → backfill → okumayı yeniye
  çevir → eskiyi ayrı deploy'da drop et.
- **Tabloyu M:N'e çevirme (gerçek örnek #195)**: `StudentProfile.mentorId` → `MentorAssignment`
  join tablosu. Güvenli sıra: (1) join tablosunu ekle + çift-yaz, (2) backfill, (3) ayrı
  deploy'da `mentorId` kolonunu drop et. *(#195 tek migration'da drop etti; ilk deploy boş
  DB'ye gittiği için sorun olmadı — aşağıya bak.)*

---

### 3. İstisna: ilk deploy / boş DB

İlk deploy'da **eski sürüm yoktur** — tüm migration'lar temiz/boş bir DB'ye uygulanır,
çakışma penceresi yoktur. Bu yüzden **ilk deploy öncesi** yazılmış migration'lar drop içerse
de güvenlidir. Kural asıl **canlıya çıktıktan sonraki** güncellemeler için geçerlidir.

---

### 4. Guard: `npm run check:migrations`

`scripts/check-migrations.mjs`, `prisma/migrations/*/migration.sql` içinde **DROP COLUMN,
DROP TABLE, RENAME, SET NOT NULL** arar. Böyle bir ifade bulur ve migration **onay yorumu
taşımıyorsa CI FAIL** eder. (CI adımı: `.github/workflows/ci.yml`.)

Bilinçli ve güvenli olduğundan eminsen (ör. ilk-deploy boş DB, ya da expand/contract'ın 3.
fazı — kimse artık kullanmıyor), migration dosyasının başına şunu ekle:

```sql
-- migration-safety-ack: expand/contract faz-3; kolon 2 deploy önce kod tarafında bırakıldı
```

Onay yorumu **düşünmeyi zorunlu kılar** — drop'un kazara canlıya gitmesini engeller.

---

### 5. Çok-instance notu

`prisma migrate deploy` bir **Postgres advisory lock** alır → aynı anda birden çok konteyner
`migrate deploy` çalıştırsa bile yalnızca biri uygular, diğerleri bekler/atlar (veri
bozulmaz). Yani entrypoint'te migration çalıştırmak tek-instance'ta olduğu gibi çok-instance'ta
da **güvenlidir**. Yine de büyük/uzun migration'larda tercih: migration'ı ayrı bir
**release/pre-deploy adımına** taşımak (Out Plane böyle bir hook sunuyorsa).

---

### 6. PR checklist (migration içeren PR'lar)

- [ ] Migration **additive** mi? (yeni alan nullable/default ile mi?)
- [ ] Drop/rename/NOT NULL var mı? Varsa **expand/contract'a** bölündü mü?
- [ ] `npm run check:migrations` yeşil mi? (yıkıcı + onaysız ifade yok)
- [ ] Backfill gerekiyorsa migration'a eklendi mi (veri kaybı yok)?
- [ ] İlk-deploy istisnası geçerliyse `-- migration-safety-ack:` gerekçesi yazıldı mı?

---

**Lisans:** Bu projeye katkıda bulunan tüm kodlar [MIT Lisansı](LICENSE) altında yayınlanır.
