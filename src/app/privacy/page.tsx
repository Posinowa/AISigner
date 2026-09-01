import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — AISigner",
  description: "AISigner platformu gizlilik politikası.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Gizlilik Politikası"
      updatedAt="25 Temmuz 2026"
      crossLink={{ href: "/terms", label: "Kullanım Koşulları →" }}
    >
      <p>
        Gizliliğiniz bizim için önemlidir. Bu politika, AISigner platformunda hangi
        verileri neden topladığımızı ve nasıl koruduğumuzu açıklar.
      </p>

      <h2>1. Topladığımız Veriler</h2>
      <ul>
        <li><strong>Hesap bilgileri:</strong> ad, soyad, e-posta, telefon (opsiyonel).</li>
        <li><strong>Profil bilgileri:</strong> deneyim, ilgi alanları, hedefler, uygunluk.</li>
        <li><strong>Platform içeriği:</strong> mesajlar, proje dosyaları, öneri/istekler.</li>
        <li><strong>Güvenlik:</strong> şifreler argon2 ile özetlenerek saklanır; asla düz metin tutulmaz.</li>
      </ul>

      <h2>2. Verileri Nasıl Kullanırız</h2>
      <ul>
        <li>Sizi uygun mentör ve projelerle eşleştirmek.</li>
        <li>Yapay zeka destekli profil analizi ve öneriler üretmek.</li>
        <li>Platform güvenliğini sağlamak (kötüye kullanım ve spam koruması).</li>
      </ul>

      <h2>3. Yapay Zeka İşleme</h2>
      <p>
        Profil analizi ve öneriler için verileriniz Google Vertex AI servisine
        işlenmek üzere iletilebilir. Bu işleme yalnızca ilgili özellikleri sağlamak
        amacıyla yapılır.
      </p>

      <h2>4. Veri Paylaşımı</h2>
      <p>
        Verilerinizi üçüncü taraflara satmayız. Yalnızca hizmetin çalışması için
        gerekli servis sağlayıcılarla (ör. bulut altyapısı) ve yasal zorunluluk
        hâlinde paylaşılır.
      </p>

      <h2>5. Erişim ve Görünürlük</h2>
      <ul>
        <li>Mentörünüz yalnızca kendisine atanmış öğrencilerin bilgilerini görür.</li>
        <li>Öneri/istekleriniz yalnızca size ve yöneticilere görünür.</li>
        <li>Mesajlarınız yalnızca konuşma tarafları arasında görünür.</li>
      </ul>

      <h2>6. Veri Güvenliği</h2>
      <p>
        Şifreler ve güvenlik cevapları özetlenerek (hash) saklanır; oturumlar
        güvenli belirteçlerle yönetilir; hassas uçlar hız sınırı ile korunur.
      </p>

      <h2>7. Yurt Dışına Aktarım ve Açık Rıza</h2>
      <p>
        Yapay zekâ destekli analiz ve öneriler için profil bilgileriniz ve
        asistana yazdığınız mesajlar <strong>Google Vertex AI</strong> hizmetine,
        yani <strong>Amerika Birleşik Devletleri&apos;ne</strong> aktarılır.
      </p>
      <p>
        Bu aktarım <strong>açık rızanıza bağlıdır</strong>. Rıza vermek zorunlu
        değildir: vermediğinizde platformu kullanmaya devam edersiniz, yalnızca
        yapay zekâ özellikleri kapalı kalır. Rızanızı kayıt sırasında verebilir,
        dilediğiniz zaman profilinizden geri alabilirsiniz.
      </p>

      {/*
        #321 — AŞAĞIDAKİLER HUKUKİ METİN GEREKTİRİR, UYDURULMAMALI.

        Bu maddeler KVKK'nın zorunlu tuttuğu ama şirket bilgisi olmadan
        yazılamayacak başlıklar. Bir avukat tarafından doldurulmalı:

        TODO(#321): Veri sorumlusu kimliği — ticari unvan, adres, MERSİS no
        TODO(#321): Saklama süreleri — her veri kategorisi için ne kadar
        TODO(#321): KVKK m.11 haklarının tam listesi ve BAŞVURU KANALI
                    (KEP adresi / başvuru formu / e-posta)
        TODO(#321): VERBİS kaydı gerekiyor mu, gerekiyorsa kayıt bilgisi
        TODO(#321): Çerez politikası (ayrı bölüm ya da ayrı sayfa)

        Mekanizma (#321) tamamlandı: açık rıza ayrı bir onay kutusuyla alınıyor,
        sürümüyle birlikte saklanıyor ve geri alınabiliyor.
      */}

      <h2>8. Haklarınız</h2>
      <p>
        Hesabınızla ilgili verilere erişim veya düzeltme talepleriniz için platform
        üzerinden yöneticinizle iletişime geçebilirsiniz.
      </p>
    </LegalPage>
  );
}
