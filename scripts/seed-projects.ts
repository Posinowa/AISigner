import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const templates = [
    {
      title: "Kişisel Portföy Web Sitesi",
      description: `## Proje Açıklaması
Kendi kişisel portföy web sitenizi oluşturun. Modern bir tasarımla projelerinizi, becerilerinizi ve iletişim bilgilerinizi sergileyecek responsive bir web sitesi geliştirin.

### Öğrenme Hedefleri
- HTML5 & CSS3 temellerini pekiştirme
- Responsive tasarım prensiplerini uygulama
- JavaScript ile interaktif bileşenler ekleme
- Git ve GitHub ile versiyon kontrolü

### Beklenen Çıktılar
- Ana sayfa (hero section, hakkımda, projeler, iletişim)
- En az 3 proje kartı
- Responsive hamburger menü
- Dark/Light mode toggle`,
      track: ["web", "frontend"],
      difficulty: "EASY" as const,
    },
    {
      title: "Todo Uygulaması (Full-Stack)",
      description: `## Proje Açıklaması
CRUD işlemleri içeren full-stack bir görev yönetim uygulaması geliştirin. Kullanıcılar görev ekleyebilir, düzenleyebilir, silebilir ve tamamlandı olarak işaretleyebilir.

### Öğrenme Hedefleri
- React ile SPA geliştirme
- REST API tasarımı ve implementasyonu
- Veritabanı modelleme (PostgreSQL/MongoDB)
- Kullanıcı kimlik doğrulama (Authentication)

### Beklenen Çıktılar
- Kullanıcı kayıt ve giriş sistemi
- Görev ekleme, düzenleme, silme
- Filtreleme (tümü, aktif, tamamlanan)
- Drag & drop ile sıralama`,
      track: ["web", "fullstack"],
      difficulty: "MEDIUM" as const,
    },
    {
      title: "Hava Durumu API Uygulaması",
      description: `## Proje Açıklaması
Harici bir hava durumu API'si kullanarak, kullanıcıların şehir bazlı hava durumu bilgilerine erişebildiği bir web uygulaması geliştirin.

### Öğrenme Hedefleri
- REST API entegrasyonu (fetch/axios)
- Asenkron JavaScript (async/await)
- Error handling ve loading states
- Çevresel değişkenler (API key güvenliği)

### Beklenen Çıktılar
- Şehir arama fonksiyonu
- Anlık hava durumu bilgisi (sıcaklık, nem, rüzgar)
- 5 günlük tahmin görünümü
- Konum bazlı otomatik algılama (Geolocation API)`,
      track: ["web", "frontend"],
      difficulty: "EASY" as const,
    },
    {
      title: "E-Ticaret REST API",
      description: `## Proje Açıklaması
Ürün listeleme, sepet yönetimi ve sipariş takibi içeren kapsamlı bir e-ticaret backend API'si tasarlayın ve geliştirin.

### Öğrenme Hedefleri
- Node.js/Express ile RESTful API tasarımı
- Veritabanı ilişkileri (one-to-many, many-to-many)
- JWT tabanlı kimlik doğrulama ve yetkilendirme
- API dokümantasyonu (Swagger/OpenAPI)

### Beklenen Çıktılar
- Ürün CRUD endpoint'leri (admin)
- Sepet yönetimi endpoint'leri
- Sipariş oluşturma ve takip
- Rol bazlı erişim kontrolü (RBAC)
- Pagination ve filtreleme`,
      track: ["web", "backend"],
      difficulty: "HARD" as const,
    },
    {
      title: "Mobil Not Defteri Uygulaması",
      description: `## Proje Açıklaması
React Native kullanarak iOS ve Android'de çalışan bir not alma uygulaması geliştirin. Notlar cihazda lokal olarak saklanır ve kategorilere ayrılabilir.

### Öğrenme Hedefleri
- React Native ile cross-platform mobil geliştirme
- AsyncStorage ile lokal veri saklama
- Mobil UI/UX tasarım prensipleri
- Navigation (stack, tab)

### Beklenen Çıktılar
- Not oluşturma, düzenleme, silme
- Kategori ve etiket sistemi
- Arama ve filtreleme
- Markdown desteği ile zengin metin
- Karanlık mod`,
      track: ["mobile", "frontend"],
      difficulty: "MEDIUM" as const,
    },
    {
      title: "Gerçek Zamanlı Chat Uygulaması",
      description: `## Proje Açıklaması
WebSocket teknolojisi kullanarak gerçek zamanlı mesajlaşma uygulaması geliştirin. Kullanıcılar odalar oluşturabilir ve anlık mesaj gönderebilir.

### Öğrenme Hedefleri
- WebSocket protokolü (Socket.IO)
- Gerçek zamanlı veri akışı
- State management (karmaşık state yönetimi)
- Veritabanı ile mesaj geçmişi saklama

### Beklenen Çıktılar
- Kullanıcı kayıt/giriş
- Sohbet odası oluşturma ve katılma
- Anlık mesajlaşma (text)
- Online kullanıcı listesi
- Mesaj geçmişi
- Yazıyor... göstergesi`,
      track: ["web", "fullstack"],
      difficulty: "HARD" as const,
    },
  ];

  for (const template of templates) {
    await prisma.projectTemplate.upsert({
      where: {
        id: template.title, // will not match, forces create
      },
      update: {},
      create: {
        title: template.title,
        description: template.description,
        track: template.track,
        difficulty: template.difficulty,
      },
    });
    console.log(`✅ Proje şablonu eklendi: ${template.title}`);
  }

  console.log(`\n🎉 Toplam ${templates.length} proje şablonu başarıyla eklendi!`);
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
