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

# 2. PostgreSQL'i başlatın
docker compose up -d

# 3. Bağımlılıkları yükleyin
npm install

# 4. .env dosyasını oluşturun
cp .env.example .env
# .env dosyasını düzenleyin

# 5. Veritabanını hazırlayın
npx prisma migrate dev
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
      expand/contract'a bölünmüş: `npm run check:migrations` yeşil (bkz. `docs/MIGRATIONS.md`)
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

**Lisans:** Bu projeye katkıda bulunan tüm kodlar [MIT Lisansı](LICENSE) altında yayınlanır.
