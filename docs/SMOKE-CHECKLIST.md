# Merge Sonrası Smoke Checklist

PR merge edildikten sonra (özellikle `develop`'a) çalıştırılacak minimal kontrol
listesi. Amaç: regresyonu erken yakalamak. (#89 madde 5)

## 1. Otomatik Kontroller

```bash
npm run lint     # 0 error olmalı (warning kabul)
npm test         # tüm testler geçmeli
npm run build    # derleme + tip kontrolü temiz olmalı
```

Şema değişen PR'lardan sonra ayrıca:

```bash
npx prisma migrate deploy   # bekleyen migration'ları uygular
npx prisma migrate status   # "Database schema is up to date!" görülmeli
npm run seed                # idempotent — hatasız tekrar çalışabilmeli
```

## 2. Manuel Smoke Adımları

Dev server (`npm run dev`) + seed verisiyle, ~5 dakika:

### Auth
- [ ] `/signin` → seed kullanıcısıyla giriş (admin/mentor/student) çalışıyor.
- [ ] Yanlış şifre anlamlı hata veriyor (5+ denemede rate-limit mesajı).
- [ ] `/forgot-password` oturumsuz açılıyor; 3 adımlı akış ilerliyor.
- [ ] Çıkış yap → korumalı sayfa `/signin`'e yönlendiriyor.

### Stajyer (student)
- [ ] `/profile-setup` açılıyor; mevcut profil varsa alanlar **prefill** geliyor.
- [ ] Admin anket soruları tanımlıysa "Ek Sorular" adımı görünüyor.
- [ ] Onboarding tamamlanınca `/student-dashboard` yükleniyor (AI özeti veya mock).
- [ ] PENDING durumdaki hesap `/account-status` sayfasına yönleniyor.

### Admin
- [ ] `/admin-dashboard` kullanıcı listesi yükleniyor (hata durumunda error state + retry).
- [ ] Rol değiştirme ve mentor atama toast geri bildirimi veriyor.
- [ ] Stajyer onaylama/reddetme durum rozetini güncelliyor.
- [ ] `/admin-dashboard/projects` şablon listesi geliyor; yeni şablon oluşturuluyor;
      aynı başlıkla ikinci şablon anlamlı hata veriyor (409).

### Mentor
- [ ] `/mentor-dashboard` öğrenci listesi yükleniyor.
- [ ] Öğrenci detayında proje atama / AI önerisi butonları çalışıyor.
- [ ] Roadmap oluşturma (AI veya mevcut) ve yayınlama akışı çalışıyor.

## 3. Sorun Bulunursa

- Küçükse: yeni bir `fix` issue'su açıp standart akışla PR gönderin
  (bkz. [CONTRIBUTING.md](../CONTRIBUTING.md)).
- Kritikse (ana akış kırık): merge'i yapan kişiye haber verin; gerekirse revert
  PR'ı açın.
