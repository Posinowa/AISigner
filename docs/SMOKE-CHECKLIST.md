# Merge Sonrası Smoke Checklist

> Bir PR develop'a merge edildikten sonra (veya deploy öncesi) çalıştırılacak
> minimal doğrulama listesi. Amaç: hızlı, düşük maliyetli regresyon yakalama.
> Kapsamlı test değil — kritik akışların "hâlâ ayakta mı" kontrolü. (#89)

## 1. Otomatik kontroller (zorunlu)

Sırayla çalıştır; hepsi yeşil olmalı:

```bash
npm run lint     # 0 hata
npm test         # tüm testler geçer
npm run build    # başarılı derleme
```

> CI (`.github/workflows/ci.yml`) bunları her PR'da zaten çalıştırır. Bu bölüm,
> lokal/deploy öncesi hızlı bir teyit içindir. `npm ci` sonrası Prisma client
> otomatik üretilir; lokalde şema değiştiyse `npx prisma generate` gerekebilir.

## 2. Manuel smoke — kritik akışlar

Gerekirse önce demo verisi: `npm run seed` (admin/mentor/student + mentor ataması
+ proje şablonları; idempotent). Test kullanıcıları için bkz. README.

### 2.1 Öğrenci profil kurulumu (`/profile-setup`) — #55/#83

- [ ] **Profil yok + soru yok:** Yeni öğrenci `/profile-setup`'a girer → 4 adımlı
      form boş gelir; "Ek Sorular" adımı görünmez; tamamlayınca dashboard'a gider.
- [ ] **Profil var (prefill):** Onboarding'i tamamlamış öğrenci tekrar girer →
      ad/soyad/telefon/doğum yılı, deneyim seviyesi radio'su (doğru seçili),
      ilgi alanları (işaretli), hedef metinleri (knownTech/futureGoal/learningStyle
      dolu) prefill gelir. Değiştirip kaydet → yeni kayıt oluşmaz, mevcut güncellenir.
- [ ] **Profil var + aktif survey soruları:** Admin en az 1 aktif soru tanımlamışsa
      son adımda "Ek Sorular" görünür; boş bırakılabilir; doldurulunca kaydedilir.
- [ ] **Survey yüklenemedi (fetch failure):** Survey fetch başarısız olursa "Ek
      Sorular" adımı **açık bir uyarı** gösterir ("şu anda yüklenemedi, boş bırakıp
      devam edebilirsiniz") — sessizce boş/kayıp gibi görünmez.

### 2.2 Admin paneli (`/admin-dashboard`) — #59/#89

- [ ] **Normal yükleme:** Kullanıcı listesi + mentor listesi gelir.
- [ ] **Kullanıcı listesi fetch fail** (DevTools → Network offline / API durdur):
      "Kullanıcılar yüklenemedi" + "Tekrar Dene" görünür — boş liste değil.
- [ ] **Mentor listesi fetch fail:** Aynı hata ekranı (usersRes veya mentorsRes
      başarısızsa error state).
- [ ] **Rol güncelleme — başarı:** Başka kullanıcının rolü değişir, başarı toast'ı.
- [ ] **Rol güncelleme — guard hatası:** Admin kendi rolünü değiştirmeye çalışır →
      "Kendi rolünüzü değiştiremezsiniz." toast'ı (string mesaj doğru gösterilir).
- [ ] **Mentor atama:** Geçerli öğrenci-mentor → başarı; geçersiz → anlamlı hata.

### 2.3 Proje şablonları (`/admin-dashboard/projects`) — #49/#59/#89

- [ ] **Liste fetch fail:** "Şablonlar yüklenemedi" + "Tekrar Dene" — empty state'e
      düşmez (boş/hata ayrımı korunur).
- [ ] **Oluştur/güncelle — başarı:** Toast + liste güncellenir.
- [ ] **Geçersiz GitHub repo URL:** `https://github.com/org/repo?tab=readme` (query),
      `.../repo#readme` (hash), `.../repo/tree/main` (derin yol) → validation hatası
      toast'ı; **yalnızca** `https://github.com/org/repo` (ve trailing slash) kabul.
- [ ] **Sil:** Onay sonrası şablon listeden kalkar.

## 3. Notlar

- Bu doküman referans içindir; her madde her PR'da tekrar edilmek zorunda değil —
  değişen alana göre ilgili bölüm(ler) yeterli.
- Otomatik kapsanan mantık (URL validasyonu, hata-mesaj ayrıştırma, goals
  compile/parse round-trip, experienceLevel map) için birim testler mevcut; bu
  liste onların **kapsamadığı UI-render/akış** kısımlarını hedefler.
