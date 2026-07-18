# AISigner — Tasarım & UX Denetim Raporu

> **Tarih:** 5 Temmuz 2026 · **Taban:** `develop` (PR #78–#82 merge edilmiş hali)
> **Kapsam:** Tüm UI yüzeyleri — auth sayfaları, admin/mentor/öğrenci panelleri, onboarding,
> roadmap editörü, mesajlaşma, AI chat botu, paylaşılan bileşenler, layout/navigasyon, tema.
> **Yöntem:** Kod okuması + desen taraması (`confirm()`, `aria-label`, responsive breakpoint,
> markdown render, hover-only aksiyon, hata/boş durum ayrımı).

Bu doküman bir **çalışma listesidir** — her madde tek başına bir issue/PR olacak şekilde
kesildi. Öncelik: P1 (kullanıcı deneyimini bugün bozan) → P2 (belirgin pürüz) → P3 (roadmap).

---

## Özet Tablosu

| # | Bulgu | Öncelik | Etki alanı | Tahmini efor |
|---|---|---|---|---|
| 1 | Markdown açıklamalar ham metin olarak gösteriliyor | 🔴 P1 | Öğrenci + Mentor + Admin | Orta |
| 2 | Ortak app shell / kalıcı navigasyon yok | 🔴 P1 | Tüm panel sayfaları | Yüksek |
| 3 | Native `confirm()` dialogları (6 yerde) | 🔴 P1 | Admin + Mentor + paylaşılan | Orta |
| 4 | Hover-only aksiyonlar dokunmatikte erişilemez | 🔴 P1 | StepFiles (öğrenci+mentor) | Düşük |
| 5 | AIChatBot: eski ton intro + no-op markdown formatlayıcı | 🟠 P2 | Öğrenci | Düşük-Orta |
| 6 | Erişilebilirlik: ikon butonlarda `aria-label` yok, modal'larda focus/Escape yok | 🟠 P2 | Tüm UI | Orta |
| 7 | Mesajlaşma liste hatası sessiz + polling görünürlükten bağımsız | 🟠 P2 | Mesajlaşma | Düşük |
| 8 | Responsive zayıf yüzeyler (roadmap editörü, Step* bileşenleri) | 🟠 P2 | Mentor + öğrenci | Orta |
| 9 | Açıklama kısaltması: koşulsuz `"..."` + markdown işaretli truncate | 🟠 P2 | Admin şablon kartları | Düşük |
| 10 | OnboardingForm adım geçişinde scroll-to-top yok | 🟠 P2 | Öğrenci onboarding | Düşük |
| 11 | Loading gösterimleri tutarsız (3 farklı spinner deseni, skeleton yok) | 🟠 P2 | Tüm UI | Orta |
| 12 | Signin sonrası `getSession` retry hack'i | 🟠 P2 | Auth | Düşük |
| 13 | Landing page yok (root → doğrudan /signin) | 🟢 P3 | Ürün geneli | Orta |
| 14 | Dark mode yok (bilinçli erteleme) | 🟢 P3 | Tüm UI | Yüksek |
| 15 | Liste sayfalaması yok (admin kullanıcılar/şablonlar) | 🟢 P3 | Admin | Orta |
| 16 | Mesajlaşma polling → SSE/WebSocket adayı | 🟢 P3 | Mesajlaşma | Yüksek |

---

## 🔴 P1 — Kritik

### 1. Markdown açıklamalar ham metin olarak gösteriliyor

**Sorun:** Admin proje şablonu formunda açıklama alanı açıkça **"Açıklama (Markdown)"** olarak
etiketli ve ipucu veriyor ("`# başlık`, `**kalın**` kullanabilirsiniz"). Seed verisindeki tüm
şablonlar markdown dolu (`## Proje Açıklaması`, `### Öğrenme Hedefleri`, `-` listeler). Ama
markdown **hiçbir yerde render edilmiyor** — repoda `react-markdown`/`remark` benzeri hiçbir
bağımlılık yok:

- Öğrenci dashboard'unda proje açıklaması ham gösteriliyor
  ([student-dashboard/page.tsx](src/app/(student)/student-dashboard/page.tsx) — `{project.projectTemplate.description}`).
- Mentor öğrenci detayında `line-clamp-2` ile ham gösteriliyor
  ([mentor-dashboard/[studentId]/page.tsx](src/app/(mentor)/mentor-dashboard/[studentId]/page.tsx)).
- Admin şablon kartında `slice(0,120)` ile ham gösteriliyor
  ([projects/page.tsx:345](src/app/(admin)/admin-dashboard/projects/page.tsx)).

Kullanıcı `## Proje Açıklaması` başlığını diyez işaretleriyle birlikte okuyor.

**Öneri:**
- `react-markdown` (+ `@tailwindcss/typography` `prose` sınıfları) ile paylaşılan bir
  `<MarkdownContent>` bileşeni; üç gösterim noktasında da kullan.
- Kart önizlemeleri (truncate edilen yerler) için markdown işaretlerini **soyan** küçük bir
  `stripMarkdown()` helper'ı (saf fonksiyon → birim test edilebilir).
- Admin formuna canlı önizleme sekmesi eklemek opsiyonel ikinci adım.

### 2. Ortak app shell / kalıcı navigasyon yok

**Sorun:** Route-group layout'ları ([admin](src/app/(admin)/layout.tsx),
[mentor](src/app/(mentor)/layout.tsx), [student](src/app/(student)/layout.tsx)) yalnızca
RBAC guard — hiçbir görsel iskelet içermiyor. Sonuç:

- Her sayfa kendi header'ını elle kuruyor; **LogoutButton her sayfada farklı konumda**.
- Geri dönüş desenleri tutarsız: `projects` sayfasında "Yönetici Paneline Dön" linki var,
  mesaj sayfalarında değişken, roadmap editöründe farklı.
- Admin'in "Proje Şablonları"na, mentorun "Mesajlar"a nasıl gideceği her sayfada yeniden
  keşfedilmek zorunda; aktif sayfa vurgusu diye bir kavram yok.

**Öneri:** Rol bazlı ince bir üst navbar bileşeni (`<AppShell role>` veya layout'lara gömülü):
logo/başlık, role göre 2-4 ana link (Panel · Projeler/Mesajlar), `UnreadBadge`'li Mesajlar,
sağda LogoutButton. Mevcut sayfa header'larındaki tekrar eden "başlık + logout" blokları
sadeleşir. Sayfa içi başlıklar kalır, üst gezinme tek yerden gelir.

### 3. Native `confirm()` dialogları

**Sorun:** 6 silme/onay noktası tarayıcının ham `confirm()`'ünü kullanıyor:

| Dosya | Eylem |
|---|---|
| [projects/page.tsx:139](src/app/(admin)/admin-dashboard/projects/page.tsx) | Şablon silme |
| [roadmap/[roadmapId]/page.tsx:244](src/app/(mentor)/mentor-dashboard/roadmap/[roadmapId]/page.tsx) | Adım silme |
| [mentor [studentId]/page.tsx:200,224](src/app/(mentor)/mentor-dashboard/[studentId]/page.tsx) | Atama kaldırma (2 aşamalı!) |
| [StepFiles.tsx:128](src/features/files/ui/StepFiles.tsx) | Dosya silme |
| [StepComments.tsx:121](src/features/messaging/ui/StepComments.tsx) | Yorum silme |

Tasarım diliyle (yumuşak köşeli kartlar, gradient butonlar) tamamen uyumsuz; buton metinleri
tarayıcı diline bağlı ("OK/Cancel"); üstelik atama kaldırmada **iki ardışık confirm** çıkıyor
(409 → ikinci onay) — kötü bir akış. Projede zaten modal deseni mevcut (analiz modalı, şablon
form modalı) — eksik olan yalnızca ortak bileşen.

**Öneri:** `components/ui/ConfirmDialog.tsx` — başlık, açıklama, tehlike/normal varyantı,
onay/iptal butonları, Escape + dışarı tıklama ile kapanma. 6 noktada `confirm()` yerine bu.
Atama kaldırmadaki iki aşamalı akış tek dialogda "ilerleme var, yine de sil" checkbox'ı veya
ikinci adım metniyle birleştirilebilir.

### 4. Hover-only aksiyonlar dokunmatikte erişilemez

**Sorun:** [StepFiles.tsx](src/features/files/ui/StepFiles.tsx) dosya satırındaki
önizle/indir/sil butonları `opacity-0 group-hover:opacity-100` — **hover'ı olmayan cihazlarda
(telefon/tablet) bu butonlar hiç görünmüyor**, öğrenci dosyasını indiremiyor/silemiyor.

**Öneri:** `opacity-100 md:opacity-0 md:group-hover:opacity-100` (mobilde daima görünür,
masaüstünde hover'da) — tek satırlık düzeltme. Aynı deseni kullanan başka yer var mı diye
`opacity-0 group-hover` taraması yapılmalı (mentor [studentId] "Atamayı Kaldır" butonu da aynı
desende — [satır 428 civarı](src/app/(mentor)/mentor-dashboard/[studentId]/page.tsx)).

---

## 🟠 P2 — Orta

### 5. AIChatBot tutarsızlıkları

[AIChatBot.tsx](src/features/ai/ui/AIChatBot.tsx):

- **Eski ton intro (satır 17):** Frontend'in hardcoded karşılama mesajı hâlâ "sorularını
  yanıtlayabilirim" diyor; backend #70'te guidance-only'ye çevrildi ("senin yerine ödevini
  yapmam..."). İki mesaj çelişiyor — frontend intro'su backend'inkiyle hizalanmalı.
- **`formatMessage` no-op (satır 233-235):** Docstring "basit markdown formatlama" diyor ama
  fonksiyon metni olduğu gibi döndürüyor. Gemini yanıtları `**kalın**`, `*` liste, `` `kod` ``
  içeriyor — kullanıcı ham işaretleri görüyor. Bulgu #1'deki `<MarkdownContent>` burada da
  kullanılabilir (veya en azından bold/kod/liste için minimal bir çevirici).
- Küçült/kapat butonlarında yalnızca `title` var, `aria-label` yok (bkz. bulgu #6).
- Sohbet geçmişi sayfa yenilemede kayboluyor (state-only) — `sessionStorage` ile hafif kalıcılık
  düşünülebilir (opsiyonel).

### 6. Erişilebilirlik eksikleri

- **`aria-label` neredeyse hiç yok:** Tüm projede yalnızca 3 adet (auth sayfalarındaki şifre
  göster/gizle). İkon-only butonlar (`title="Sil"` vb. — StepFiles, StepComments, projects
  kartı, chat botu, analiz modalı X) ekran okuyucuya isimsiz. `title` hover gerektirir ve
  mobilde çalışmaz; her ikon-only butona `aria-label` eklenmeli.
- **Modal'larda klavye desteği yok:** Analiz modalı, şablon form modalı, proje atama modalı —
  hiçbirinde Escape ile kapanma, focus trap veya açılışta focus yönetimi yok. Bulgu #3'teki
  `ConfirmDialog` ile birlikte ortak bir `Modal` temeli düşünülebilir.
- **Çok küçük metinler:** `text-[9px]`/`text-[10px]` rozetler (UnreadBadge, rol rozetleri)
  okunabilirlik sınırının altında; en az `text-xs` hedeflenmeli.

### 7. Mesajlaşma: sessiz liste hatası + görünürlükten bağımsız polling

[MessagingPanel.tsx](src/features/messaging/ui/MessagingPanel.tsx):

- `loadConversations`/`loadMessages` hata verirse sessizce boş liste gösteriyor — "hiç konuşma
  yok" ile "istek başarısız" ayrımı yok (admin sayfalarında PR #88'de düzeltilen desenin aynısı;
  aynı hata+"Tekrar Dene" çözümü buraya da uygulanmalı).
- Polling (panel 5 sn, [UnreadBadge](src/features/messaging/ui/UnreadBadge.tsx) 15 sn) sekme
  arka plandayken de sürüyor — `document.visibilityState` kontrolüyle duraklatmak ucuz bir
  iyileştirme.

### 8. Responsive zayıf yüzeyler

Breakpoint yoğunluğu taraması net bir tablo veriyor: OnboardingForm (8) ve admin dashboard (7)
iyi durumdayken, şu yüzeyler dar ekranda elden geçirilmemiş:

- [Roadmap editörü](src/app/(mentor)/mentor-dashboard/roadmap/[roadmapId]/page.tsx) — 750 satır,
  yalnızca 1 breakpoint. Düzenleme formu ve accordion başlığındaki rozet yığını dar ekranda taşar.
- StepComments / StepFiles / ProfileAnalysisCard / AIChatBot — 0 breakpoint. AIChatBot 380px
  sabit genişlik (`max-w-[calc(100vw-2rem)]` koruması var ama içerik sıkışıyor).
- Admin kullanıcı tablosu mobilde `grid-cols-1`'e düşüyor; satır içindeki select + butonlar alt
  alta sıkışıyor — mobil için kart görünümü değerlendirilmeli.

**Öneri:** Gerçek cihaz genişliklerinde (375px) sayfa sayfa geçip taşmaları düzeltmek; bu
denetim maddesi kendi başına bir "mobil geçiş turu" issue'su olmalı.

### 9. Açıklama kısaltması pürüzleri

[projects/page.tsx:345](src/app/(admin)/admin-dashboard/projects/page.tsx):
`{template.description.slice(0, 120)}...` — açıklama 120 karakterden **kısa olsa da** "..."
ekleniyor; kesme kelime ortasında olabiliyor; markdown işaretleri (`##`) önizlemede görünüyor.
Bulgu #1'deki `stripMarkdown()` + akıllı truncate helper'ı (kelime sınırında, koşullu ellipsis)
ikisini birden çözer.

### 10. OnboardingForm adım geçişinde scroll sıfırlanmıyor

Uzun bir adımda (ör. deneyim adımındaki textarea'lar) sayfanın altındayken "Sonraki Adım"a
basınca yeni adım açılıyor ama scroll pozisyonu korunuyor — kullanıcı yeni adımın ortasından
başlıyor, üstteki başlığı/ilk alanları görmüyor. `setStep` sonrası form kartına
`scrollIntoView({ behavior: "smooth" })` yeterli.

### 11. Loading gösterimleri tutarsız

Üç farklı desen bir arada: `Loader2` spin (çoğu yer), custom `border-b-2` dönen div
(projects sayfası), üç zıplayan nokta (chat botu). Skeleton hiç yok — liste sayfaları
yüklenirken tam sayfa spinner gösteriyor (layout shift). Öneri: `Loader2`'yi standart kabul et;
admin/mentor liste sayfalarına basit skeleton satırları (opsiyonel ikinci adım).

### 12. Signin sonrası `getSession` retry hack'i

[signin/page.tsx:48-57](src/app/(auth)/signin/page.tsx): cookie'nin oturmasını beklemek için
5×100ms `getSession()` döngüsü. Çalışıyor ama kırılgan (yavaş ağda 500ms yetmeyebilir → kullanıcı
`/`'a düşer). Daha sağlam: `signIn`'den sonra rolü client'ta çözmek yerine `/` route'unda
(server) session'a bakıp role göre redirect etmek — signin yalnızca `window.location.href = "/"`
yapar, yönlendirme kararı sunucuda tek yerde toplanır.

---

## 🟢 P3 — Düşük / Roadmap

### 13. Landing page yok
`/` doğrudan `/signin`'e yönlendiriyor. Açık kaynak bir ürün için kısa bir tanıtım sayfası
(ne işe yarar, roller, ekran görüntüsü, GitHub linki) hem yeni kullanıcı hem katkıcı için değerli.

### 14. Dark mode yok
[globals.css](src/app/globals.css)'te bilinçli olarak light theme sabitlenmiş (doğru karar,
notu da mevcut). İleride istenirse: önce token'ları `dark:` varyantlarıyla genişlet, sonra
sayfa sayfa geçir. Büyük iş — ancak tema token altyapısı hazır olduğu için zemin iyi.

### 15. Liste sayfalaması yok
Admin kullanıcı listesi ve şablon listesi tüm kayıtları tek seferde çekiyor. Kullanıcı sayısı
yüzleri geçince hem API yanıtı hem render maliyeti büyür. Arama/filtre client-side. Cursor-based
pagination (mesajlar API'sinde zaten `cursor` deseni var — aynı desen kopyalanabilir).

### 16. Mesajlaşmada gerçek zamanlılık
5 sn polling MVP için kabul edilebilir; ölçekte SSE veya WebSocket'e geçiş (DEPLOYMENT.md'deki
tek-instance kısıtlarıyla birlikte düşünülmeli).

---

## ✅ Bu denetimde TEKRAR İŞ ÇIKARMAYACAK olanlar (zaten açık PR'larda çözüldü)

Aşağıdakiler taramada görünüyor ama **açık PR'larda düzeltilmiş durumda** — merge edilince
kapanacaklar, yeniden issue açmayın:

| Konu | PR |
|---|---|
| Admin kullanıcı listeleme hatası boş liste gibi görünüyor; rol değiştirmede geri bildirim yok; şablon listeleme aynı | [#88](https://github.com/Posinowa/AISigner/pull/88) |
| Anket adımı fetch hatası sessiz; cevap validasyon mesajı obje gelince kayboluyor | [#84](https://github.com/Posinowa/AISigner/pull/84) |
| AI analiz kartı loading/empty/error ayrımı regresyon testleri | [#84](https://github.com/Posinowa/AISigner/pull/84) |
| Profil setup mevcut veriyi prefill etmiyor | [#85](https://github.com/Posinowa/AISigner/pull/85) |
| README/KURULUM çelişkileri | [#87](https://github.com/Posinowa/AISigner/pull/87) |

---

## Önerilen Uygulama Sırası

Her satır ~1 issue/PR:

1. **Markdown render** (bulgu 1 + 9 birlikte) — en görünür kullanıcı değeri.
2. **ConfirmDialog bileşeni + 6 confirm() değişimi** (bulgu 3) — hızlı, yüksek tutarlılık kazancı.
3. **Dokunmatik aksiyon düzeltmesi** (bulgu 4) — küçük, bağımsız.
4. **AIChatBot düzeltmeleri** (bulgu 5) — intro + markdown, madde 1'in bileşenini yeniden kullanır.
5. **App shell / rol bazlı navbar** (bulgu 2) — büyük ama dönüştürücü; sayfa header'ları sadeleşir.
6. **a11y turu** (bulgu 6) — aria-label taraması + modal klavye desteği (ConfirmDialog ile birleşebilir).
7. **Mesajlaşma hata durumu + visibility-aware polling** (bulgu 7).
8. **Mobil geçiş turu** (bulgu 8 + 10) — 375px'te sayfa sayfa.
9. **Loading standardizasyonu** (bulgu 11) ve **signin redirect sadeleştirme** (bulgu 12).
10. P3 maddeleri (13-16) ürün roadmap'ine.
