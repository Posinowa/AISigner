import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";
import { VERI_SORUMLUSU, SAKLAMA_SURELERI, eksikAlanlar } from "@/features/legal/kvkk";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — AISigner",
  description: "AISigner platformu gizlilik politikası ve KVKK aydınlatma metni.",
};

/**
 * #449 — KVKK aydınlatma metninin KANUNDA SABİT olan kısmı.
 *
 * ⚠️ NE YAZILDI, NE YAZILMADI — ayrım bilinçli:
 *
 * YAZILDI, çünkü KANUNDAN ya da KODDAN doğrulanabiliyor:
 *   - KVKK m.11 hakları (kanun metni, şirkete göre değişmez),
 *   - m.13 başvuru usulü ve 30 günlük süre, m.14 şikâyet yolu,
 *   - çerez bölümü — platformun GERÇEKTEN kullandığı çerezler koddan
 *     çıkarıldı: yalnız NextAuth'un oturum/CSRF/callback çerezleri var,
 *     analitik, izleme ve üçüncü taraf çerezi YOK, localStorage
 *     kullanılmıyor (tarandı, doğrulandı).
 *
 * YAZILMADI, çünkü UYDURULAMAZ:
 *   - veri sorumlusunun ticari unvanı, adresi, MERSİS numarası,
 *   - resmî başvuru kanalı (KEP adresi / e-posta),
 *   - saklama süreleri (şirket politikası kararı),
 *   - VERBİS kaydının gerekip gerekmediği (ciro/çalışan eşiğine bağlı).
 *
 * Bunlar `features/legal/kvkk.ts` içinde TEK BLOKTA duruyor. Doldurmak o
 * dosyadaki alanları yazmaktan ibaret; sayfa kendini otomatik günceller ve
 * "tamamlanıyor" uyarısı kendiliğinden kalkar.
 *
 * ⚠️ UYDURMA VERİ BASMAK YERİNE EKSİKLİĞİ SÖYLEYEN bir uyarı gösteriliyor.
 * Yanlış bir unvan/adres, eksik bilgiden daha zararlıdır: kullanıcı ona
 * güvenip başvuru yapar ve başvurusu hiçbir yere ulaşmaz.
 */
export default function PrivacyPage() {
  const eksik = eksikAlanlar();

  return (
    <LegalPage
      title="Gizlilik Politikası ve KVKK Aydınlatma Metni"
      updatedAt="4 Eylül 2026"
      crossLink={{ href: "/terms", label: "Kullanım Koşulları →" }}
    >
      <p>
        Gizliliğiniz bizim için önemlidir. Bu metin, 6698 sayılı Kişisel Verilerin
        Korunması Kanunu (KVKK) kapsamında hangi verilerinizi neden işlediğimizi,
        kimlerle paylaştığımızı ve haklarınızı nasıl kullanabileceğinizi açıklar.
      </p>

      {eksik.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Bu metnin bir bölümü tamamlanma aşamasındadır
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Aşağıdaki başlıklarda yer alacak bilgiler henüz yayımlanmadı:{" "}
            {eksik.join(", ")}. Bu süre zarfında KVKK kapsamındaki taleplerinizi
            platform üzerinden yöneticinize ileterek iletebilirsiniz; talebiniz
            kayda alınır ve yasal süresi içinde yanıtlanır.
          </p>
        </div>
      )}

      <h2>1. Veri Sorumlusu</h2>
      {VERI_SORUMLUSU ? (
        <ul>
          <li><strong>Ticari unvan:</strong> {VERI_SORUMLUSU.unvan}</li>
          <li><strong>Adres:</strong> {VERI_SORUMLUSU.adres}</li>
          <li><strong>MERSİS numarası:</strong> {VERI_SORUMLUSU.mersis}</li>
          <li><strong>Başvuru kanalı:</strong> {VERI_SORUMLUSU.basvuruKanali}</li>
        </ul>
      ) : (
        <p>
          Veri sorumlusunun kimlik ve iletişim bilgileri bu bölümde yayımlanacaktır.
          Bilgiler yayımlanana kadar taleplerinizi platform üzerinden yöneticinize
          iletebilirsiniz.
        </p>
      )}

      <h2>2. İşlenen Kişisel Veriler</h2>
      <ul>
        <li><strong>Kimlik ve iletişim:</strong> ad, soyad, e-posta, telefon (opsiyonel), doğum yılı, şehir.</li>
        <li><strong>Eğitim ve mesleki bilgi:</strong> okul, bölüm, sınıf, deneyim düzeyi, ilgi alanları, hedefler, haftalık uygunluk.</li>
        <li><strong>Platform içeriği:</strong> mesajlar, adım yorumları, yüklenen proje dosyaları, öneri ve istekler.</li>
        <li><strong>İşlem güvenliği:</strong> giriş denemeleri ve hız sınırı kayıtları, e-posta doğrulama durumu.</li>
        <li><strong>Şifreler:</strong> argon2 ile özetlenerek saklanır; hiçbir aşamada düz metin tutulmaz ve geri döndürülemez.</li>
      </ul>

      <h2>3. İşleme Amaçları</h2>
      <ul>
        <li>Sizi uygun mentör ve projelerle eşleştirmek.</li>
        <li>Staj sürecinizi yürütmek: yol haritası, adım takibi, mentör iletişimi.</li>
        <li>Açık rızanıza bağlı olarak yapay zekâ destekli profil analizi ve öneriler üretmek.</li>
        <li>Staj tamamlandığında katılım belgesi düzenlemek ve doğrulanabilir kılmak.</li>
        <li>Platform güvenliğini sağlamak (kötüye kullanım ve spam koruması).</li>
      </ul>

      <h2>4. Yapay Zekâ İşleme ve Yurt Dışına Aktarım</h2>
      <p>
        Yapay zekâ destekli analiz ve öneriler için profil bilgileriniz, asistana
        yazdığınız mesajlar ve —etkinleştirilmişse— proje deponuza gönderdiğiniz
        kod değişiklikleri <strong>Google Vertex AI</strong> hizmetine, yani{" "}
        <strong>Amerika Birleşik Devletleri&apos;ne</strong> aktarılır.
      </p>
      <p>
        Bu aktarım <strong>açık rızanıza bağlıdır</strong>. Rıza vermek zorunlu
        değildir: vermediğinizde platformu kullanmaya devam edersiniz, yalnızca
        yapay zekâ özellikleri kapalı kalır. Rızanızı kayıt sırasında verebilir,
        dilediğiniz zaman profilinizden geri alabilirsiniz.
      </p>
      <p>
        Rızanızı geri aldığınızda, yapay zekâ ile üretilmiş türev analizleriniz
        (profil analizi ve mentör eşleştirme değerlendirmesi) silinir.
      </p>

      <h2>5. Veri Paylaşımı</h2>
      <p>
        Kişisel verilerinizi üçüncü taraflara satmayız. Paylaşım yalnızca hizmetin
        çalışması için gerekli hizmet sağlayıcılarla (bulut altyapısı, e-posta
        gönderimi, yapay zekâ hizmeti) ve yasal olarak yetkili kamu kurum ve
        kuruluşlarının talebi hâlinde yapılır.
      </p>

      <h2>6. Erişim ve Görünürlük</h2>
      <ul>
        <li>Mentörünüz yalnızca kendisine atanmış öğrencilerin bilgilerini görür.</li>
        <li>Takım projelerinde pano, yorumlar ve teslim dosyaları takım üyeleri arasında ortaktır.</li>
        <li>Öneri ve istekleriniz yalnızca size ve yöneticilere görünür.</li>
        <li>Mesajlarınız yalnızca konuşmanın taraflarına görünür.</li>
        <li>
          Katılım belgeniz, belge numarasıyla herkese açık olarak doğrulanabilir;
          doğrulama sayfasında yalnızca belgenin geçerliliğini teyit etmeye yetecek
          bilgi gösterilir.
        </li>
      </ul>

      <h2>7. Veri Güvenliği</h2>
      <p>
        Şifreler özetlenerek (hash) saklanır; oturumlar imzalı belirteçlerle
        yönetilir; hassas uçlar hız sınırıyla korunur; yüklenen dosyalar tür ve
        içerik doğrulamasından geçirilir ve yalnızca yetkili kullanıcılara sunulur.
      </p>

      <h2>8. Çerezler</h2>
      <p>
        Platform <strong>yalnızca zorunlu çerezler</strong> kullanır. Reklam,
        analitik veya izleme amaçlı çerez, piksel ya da üçüncü taraf betiği
        çalıştırılmaz; tarayıcınızın yerel deposunda (localStorage) veri
        tutulmaz.
      </p>
      <ul>
        <li>
          <strong>Oturum çerezi:</strong> giriş yaptıktan sonra kimliğinizi her
          istekte yeniden doğrulamadan tanımak için kullanılır. Çıkış
          yaptığınızda geçersiz kalır.
        </li>
        <li>
          <strong>CSRF çerezi:</strong> formların sizin adınıza başka bir siteden
          gönderilmesini engeller.
        </li>
        <li>
          <strong>Yönlendirme çerezi:</strong> giriş sonrası döneceğiniz sayfayı
          kısa süreliğine tutar.
        </li>
      </ul>
      <p>
        Bu çerezler hizmetin çalışması için gereklidir; tarayıcınızdan
        engellerseniz platforma giriş yapamazsınız.
      </p>

      <h2>9. Saklama Süreleri</h2>
      {SAKLAMA_SURELERI ? (
        <ul>
          {SAKLAMA_SURELERI.map((s) => (
            <li key={s.kategori}>
              <strong>{s.kategori}:</strong> {s.sure}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          Kişisel verileriniz, işlendikleri amaç için gerekli olan süre boyunca ve
          ilgili mevzuatta öngörülen zorunlu saklama süreleri kadar saklanır. Veri
          kategorilerine göre süreler bu bölümde yayımlanacaktır.
        </p>
      )}
      <p>
        Hesabınız silindiğinde profil bilgileriniz, mesajlarınız ve yüklediğiniz
        dosyalar silinir. Katkı geçmişiniz, düzenlenmiş bir katılım belgesinin
        dayanağı olduğu ölçüde saklanmaya devam edebilir.
      </p>

      <h2>10. KVKK Madde 11 Kapsamındaki Haklarınız</h2>
      <p>Kişisel verileriyle ilgili olarak herkes veri sorumlusuna başvurarak:</p>
      <ul>
        <li>Kişisel verilerinin işlenip işlenmediğini öğrenme,</li>
        <li>Kişisel verileri işlenmişse buna ilişkin bilgi talep etme,</li>
        <li>
          Kişisel verilerinin işlenme amacını ve bunların amacına uygun kullanılıp
          kullanılmadığını öğrenme,
        </li>
        <li>
          Yurt içinde veya yurt dışında kişisel verilerinin aktarıldığı üçüncü
          kişileri bilme,
        </li>
        <li>
          Kişisel verilerinin eksik veya yanlış işlenmiş olması hâlinde bunların
          düzeltilmesini isteme,
        </li>
        <li>
          Kanunun 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinin
          silinmesini veya yok edilmesini isteme,
        </li>
        <li>
          Düzeltme, silme ve yok etme işlemlerinin, kişisel verilerin aktarıldığı
          üçüncü kişilere bildirilmesini isteme,
        </li>
        <li>
          İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz
          edilmesi suretiyle kişinin kendisi aleyhine bir sonucun ortaya çıkmasına
          itiraz etme,
        </li>
        <li>
          Kişisel verilerinin kanuna aykırı olarak işlenmesi sebebiyle zarara
          uğraması hâlinde zararın giderilmesini talep etme
        </li>
      </ul>
      <p>haklarına sahiptir.</p>

      <h2>11. Başvuru Yolu</h2>
      <p>
        Yukarıdaki haklarınıza ilişkin taleplerinizi, Kanunun 13. maddesi uyarınca
        veri sorumlusuna yazılı olarak veya Kişisel Verileri Koruma Kurulunun
        belirlediği diğer yöntemlerle iletebilirsiniz.
      </p>
      <p>
        Talebiniz, niteliğine göre en kısa sürede ve <strong>en geç otuz gün
        içinde</strong> ücretsiz olarak sonuçlandırılır. İşlemin ayrıca bir
        maliyet gerektirmesi hâlinde Kurulca belirlenen tarifedeki ücret alınabilir.
      </p>
      <p>
        Başvurunuzun reddedilmesi, verilen cevabı yetersiz bulmanız veya süresinde
        cevap verilmemesi hâlinde; cevabı öğrendiğiniz tarihten itibaren otuz ve her
        hâlde başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma
        Kuruluna şikâyette bulunabilirsiniz.
      </p>
      {VERI_SORUMLUSU ? (
        <p>
          Başvurularınızı <strong>{VERI_SORUMLUSU.basvuruKanali}</strong> üzerinden
          iletebilirsiniz.
        </p>
      ) : (
        <p>
          Resmî başvuru kanalı bu bölümde yayımlanacaktır. O zamana kadar
          taleplerinizi platform üzerinden yöneticinize iletebilirsiniz; talebiniz
          kayda alınır ve yasal süresi içinde yanıtlanır.
        </p>
      )}
    </LegalPage>
  );
}
