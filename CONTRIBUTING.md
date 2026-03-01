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

## Branch İsimlendirme

```
feat/<scope>-kısa-açıklama    # Yeni özellik
fix/<scope>-kısa-açıklama     # Hata düzeltmesi
docs/<scope>-kısa-açıklama    # Dokümantasyon
refactor/<scope>-kısa-açıklama # Refactoring
chore/<scope>-kısa-açıklama   # Bakım işleri
```

**Örnekler:**
```
feat/auth-social-login
fix/signup-validation-bug
docs/readme-update
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
- [ ] TypeScript hata vermiyor
- [ ] İlgili migration varsa eklenmiş

### PR Açarken
1. PR başlığı commit convention'a uygun olmalı
2. Şu bilgileri eklemelisiniz:
   - **Ne değişti?** — Kısa açıklama
   - **Neden değişti?** — Motivasyon / ilgili issue
   - **Nasıl test edilir?** — Adım adım test talimatları
3. Ekran görüntüsü / GIF teşvik edilir (UI değişiklikleri için)

### PR İnceleme
- En az 1 maintainer onayı gereklidir
- Küçük ve odaklı PR'lar tercih edilir (tek bir özellik veya düzeltme)
- Büyük değişiklikler önce issue'da tartışılmalıdır

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
