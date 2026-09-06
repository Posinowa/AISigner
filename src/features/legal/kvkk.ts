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

export type HataTeshisSaglayicisi = {
  /** Hizmetin adı — aydınlatma metninde yazılı görünür. */
  ad: string;
  /** Verinin işlendiği ülke/bölge. */
  bolge: string;
  /** Sağlayıcının kendi gizlilik metni. */
  gizlilikUrl: string;
};

/**
 * Sunucu hatalarının teşhisi için kullanılan üçüncü taraf hizmet.
 *
 * ⚠️ BU ALAN İLE ÇALIŞMA ZAMANI BİRBİRİNE BAĞLI (#519). `lib/sentry.ts`
 * burası `null` iken KENDİNİ AÇMAZ — DSN tanımlı olsa bile. Sebep: hata
 * teşhis hizmeti yurt dışına aktarımdır ve aydınlatma metninde YAZILI
 * olmadan yapılamaz. İkisi ayrı ayrı yönetilseydi, biri açılıp diğeri
 * unutulduğunda platform sessizce beyan edilmemiş bir aktarım yapardı.
 *
 * ⚠️ AKTARIM AÇIK RIZAYA BAĞLI DEĞİL, Vertex AI'dan (#321) FARKLI: orada
 * işlenen şey stajyerin KENDİ verisi ve amaç ona hizmet üretmek. Burada
 * işlenen şey uygulamanın kendi hata kaydı; kişisel veri taşımaması için
 * `lib/sentry.ts` gövdeyi, başlıkları, çerezleri ve IP'yi ayıklıyor.
 * Yine de metinde YAZILI — beyan edilmemiş bir alıcı, zararsız olsa bile
 * KVKK m.10 açısından eksiktir.
 */
export const HATA_TESHIS: HataTeshisSaglayicisi | null = {
  ad: "Sentry",
  bolge: "Avrupa Birliği / ABD",
  gizlilikUrl: "https://sentry.io/privacy/",
};

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
