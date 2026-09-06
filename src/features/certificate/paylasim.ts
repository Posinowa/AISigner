import { uygulamaUrl } from "@/lib/app-url";

/**
 * Sertifikanın DIŞARIYA açılan bağlantıları (#323).
 *
 * Saf fonksiyonlar: URL üretimi test edilebilir olsun ve React bileşenine
 * gömülü kalmasın.
 */

/** Uygulamanın public adresi. SEO ile aynı kaynağı kullanır (#204). */
function uygulamaAdresi(): string {
  return uygulamaUrl();
}

/**
 * Public doğrulama sayfasının adresi.
 *
 * ⚠️ #208 doğrulama sayfasını ve seri numarasını kurmuştu ama sertifikanın
 * kendisi oraya İŞARET ETMİYORDU: belgeyi alan bir işveren doğrulamaya
 * ulaşamıyordu, yani özelliğin değeri kullanılmıyordu. QR ve bu bağlantı o
 * boşluğu kapatıyor.
 */
export function dogrulamaUrl(certificateNumber: string): string {
  return `${uygulamaAdresi()}/verify-certificate/${encodeURIComponent(certificateNumber)}`;
}

export type LinkedInParametreleri = {
  certificateNumber: string;
  /** Belge tarihi (ISO). Yoksa yıl/ay parametreleri gönderilmez. */
  issuedAt: string | null;
  organizasyon?: string;
  sertifikaAdi?: string;
};

/**
 * LinkedIn "Add to Profile" bağlantısı.
 *
 * Bu bir API DEĞİL — parametreli bir URL. Kullanıcı tıkladığında LinkedIn'in
 * sertifika ekleme formu, alanları önceden doldurulmuş halde açılır. Bu yüzden
 * token, izin ya da entegrasyon gerekmiyor.
 *
 * `certUrl` public doğrulama sayfasına işaret eder: LinkedIn profilindeki
 * kayıttan doğrulamaya tıklanabilir bir yol kalır.
 */
export function linkedInEkleUrl({
  certificateNumber,
  issuedAt,
  organizasyon = "Posinowa",
  sertifikaAdi = "Posinowa Yazılım Stajı Başarı Sertifikası",
}: LinkedInParametreleri): string {
  const p = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: sertifikaAdi,
    organizationName: organizasyon,
    certUrl: dogrulamaUrl(certificateNumber),
    certId: certificateNumber,
  });

  // Tarih yoksa hiç göndermiyoruz: LinkedIn eksik/hatalı tarihte formu
  // yanlış dolduruyor ve kullanıcı bunu fark etmeyebiliyor.
  if (issuedAt) {
    const t = new Date(issuedAt);
    if (!Number.isNaN(t.getTime())) {
      p.set("issueYear", String(t.getFullYear()));
      p.set("issueMonth", String(t.getMonth() + 1));
    }
  }

  return `https://www.linkedin.com/profile/add?${p.toString()}`;
}
