/**
 * KVKK aydınlatma metninin ŞİRKETE ÖZEL alanları (#449).
 *
 * ⚠️ BU DOSYA BİLEREK BOŞ. Buradaki bilgiler kanundan ya da koddan
 * türetilemez; şirketin kendi verileridir. Uydurulmuş bir unvan/adres,
 * eksik bilgiden DAHA ZARARLIDIR: kullanıcı ona güvenip başvurur ve
 * başvurusu hiçbir yere ulaşmaz.
 *
 * DOLDURMAK İÇİN: aşağıdaki `null` değerlerini gerçek bilgilerle
 * değiştirmek yeterli. `/privacy` sayfası kendini otomatik günceller ve
 * "tamamlanma aşamasındadır" uyarısı kendiliğinden kalkar — sayfa
 * metnine dokunmaya gerek yok.
 *
 * ⚠️ VERBİS: kayıt yükümlülüğü çalışan sayısı/yıllık mali bilanço
 * eşiklerine bağlı, yani bu depodan bilinemez. Yükümlülük varsa kayıt
 * bilgisi `VERI_SORUMLUSU` içine bir alan olarak eklenmeli; yoksa
 * eklenmemeli — "VERBİS'e kayıtlı değildir" demek de bir beyandır ve
 * doğruluğu şirkete aittir.
 *
 * ⚠️ Bu dosya hukuki danışmanlık YERİNE GEÇMEZ. Metnin kanunda sabit olan
 * kısmı (m.11 hakları, m.13 süreler, m.14 şikâyet yolu) yazıldı; şirkete
 * özel kısmın bir hukukçu tarafından gözden geçirilmesi gerekir.
 */

export type VeriSorumlusu = {
  /** Ticari unvan — ör. "Posinowa Yazılım A.Ş." */
  unvan: string;
  /** Tebligata elverişli açık adres. */
  adres: string;
  /** MERSİS numarası. */
  mersis: string;
  /**
   * Resmî başvuru kanalı — KEP adresi, başvuru formu bağlantısı ya da
   * KVKK başvurularına ayrılmış e-posta adresi.
   */
  basvuruKanali: string;
};

/** Doldurulunca sayfadaki "Veri Sorumlusu" bölümü otomatik yayımlanır. */
export const VERI_SORUMLUSU: VeriSorumlusu | null = null;

export type SaklamaSuresi = {
  /** Veri kategorisi — ör. "Hesap ve iletişim bilgileri". */
  kategori: string;
  /** Süre ve dayanağı — ör. "Hesap silinene kadar; sonrasında 6 ay." */
  sure: string;
};

/**
 * Saklama süreleri.
 *
 * Şirket politikası kararı: her veri kategorisi için ne kadar süreyle
 * saklandığı ve dayanağı. Boş bırakıldığında sayfa genel bir ifade
 * gösteriyor, uydurma bir süre değil.
 */
export const SAKLAMA_SURELERI: SaklamaSuresi[] | null = null;

/**
 * Henüz yayımlanmamış başlıkların adları.
 *
 * Sayfa bunu kullanıcıya gösterilen uyarıda listeliyor: hangi bilginin
 * eksik olduğunu SÖYLEMEK, eksikliği sessizce gizlemekten dürüst.
 * Hepsi doldurulduğunda boş dizi döner ve uyarı hiç render edilmez.
 */
export function eksikAlanlar(): string[] {
  const eksik: string[] = [];
  if (!VERI_SORUMLUSU) eksik.push("Veri Sorumlusu", "Başvuru Yolu");
  if (!SAKLAMA_SURELERI) eksik.push("Saklama Süreleri");
  return eksik;
}
