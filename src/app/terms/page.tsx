import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = {
  title: "Kullanım Koşulları — AISigner",
  description: "AISigner platformu kullanım koşulları.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Kullanım Koşulları"
      updatedAt="25 Temmuz 2026"
      crossLink={{ href: "/privacy", label: "Gizlilik Politikası →" }}
    >
      <p>
        AISigner&apos;a hoş geldiniz. Bu platform; mentör ve stajyerleri eşleştiren,
        yapay zeka destekli bir staj ve proje yönetim aracıdır. Hesap oluşturarak
        aşağıdaki koşulları kabul etmiş olursunuz.
      </p>

      <h2>1. Hesap ve Uygunluk</h2>
      <ul>
        <li>Verdiğiniz bilgilerin doğru ve güncel olduğunu taahhüt edersiniz.</li>
        <li>Hesap güvenliğinizden (şifre, güvenlik soruları) siz sorumlusunuz.</li>
        <li>Stajyer hesapları bir yönetici onayından sonra tam erişim kazanır.</li>
      </ul>

      <h2>2. Kabul Edilebilir Kullanım</h2>
      <ul>
        <li>Platformu yalnızca eğitim ve mesleki gelişim amacıyla kullanırsınız.</li>
        <li>Diğer kullanıcıları taciz eden, yanıltan veya zarar veren içerik yasaktır.</li>
        <li>Sistemi kötüye kullanma, otomatik kötüye kullanım ve izinsiz erişim girişimleri yasaktır.</li>
      </ul>

      <h2>3. İçerik ve Fikri Mülkiyet</h2>
      <p>
        Yüklediğiniz proje ve içeriklerin haklarının size ait olduğunu; bunları
        platformda göstermemiz için gerekli izni verdiğinizi kabul edersiniz.
        Platformun kendi markası, tasarımı ve yazılımı AISigner&apos;a aittir.
      </p>

      <h2>4. Yapay Zeka Özellikleri</h2>
      <p>
        Profil analizi, proje önerileri ve yol haritası gibi yapay zeka çıktıları
        yol gösterici niteliktedir; kesin veya hatasız olmayabilir. Nihai kararlarda
        mentör ve kullanıcı sorumludur.
      </p>

      <h2>5. Sorumluluğun Sınırlanması</h2>
      <p>
        Platform &quot;olduğu gibi&quot; sunulur. Hizmet kesintileri veya veri
        kayıplarından doğabilecek dolaylı zararlardan sorumlu tutulamayız.
      </p>

      <h2>6. Değişiklikler</h2>
      <p>
        Bu koşulları zaman zaman güncelleyebiliriz. Önemli değişikliklerde
        kullanıcıları bilgilendirmeye çalışırız. Güncel sürüm her zaman bu sayfada
        yer alır.
      </p>

      <h2>7. İletişim</h2>
      <p>
        Sorularınız için platform üzerinden yöneticinizle iletişime geçebilirsiniz.
      </p>
    </LegalPage>
  );
}
