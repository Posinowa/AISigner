/**
 * Bildirim olay türleri (#380).
 *
 * ⚠️ E-POSTA LİSTESİ BİLİNÇLİ OLARAK DAR.
 *
 * Yalnız üç olay e-postaya bağlı ve ortak özellikleri şu: kullanıcı sonucu
 * öğrenmek için **giriş yapamayabilir ya da günlerce bekliyordur**. Reddedilmiş
 * bir hesabın sahibi panele zaten giremez — e-posta olmasa hiç haber alamaz.
 *
 * "Yeni mesaj" bilerek DIŞARIDA: sıklığı yüksek, olay başına e-posta karşılıklı
 * bir sohbette gürültüye dönerdi. Uygulama içi bildirim + #329 canlı akışı bu
 * ihtiyacı zaten karşılıyor.
 *
 * ⚠️ İlk sürümde kapatma anahtarı YOK. Bedeli açık: e-posta hacmi yanlış
 * ayarlanırsa kullanıcının kaçış yolu olmaz. Liste tam bu yüzden dar tutuldu.
 */

export const BILDIRIM_TURLERI = {
  HESAP_KARARI: "HESAP_KARARI",
  MENTOR_ATANDI: "MENTOR_ATANDI",
  ONERI_KARARI: "ONERI_KARARI",
  CALISMA_ALANI_KARARI: "CALISMA_ALANI_KARARI",
  YENI_MESAJ: "YENI_MESAJ",
  ADIM_REVIZYON: "ADIM_REVIZYON",
  /** #397: Takılma radarı — mentöre bildirim, öğrenciye opt-in. */
  ADIM_TAKILDI: "ADIM_TAKILDI",
  DOSYA_YUKLENDI: "DOSYA_YUKLENDI",
} as const;

export type BildirimTuru = (typeof BILDIRIM_TURLERI)[keyof typeof BILDIRIM_TURLERI];

/** E-posta da gönderilecek olaylar. Diğerleri yalnız uygulama içi. */
export const EPOSTA_GONDERILEN: ReadonlySet<BildirimTuru> = new Set([
  BILDIRIM_TURLERI.HESAP_KARARI,
  BILDIRIM_TURLERI.MENTOR_ATANDI,
  BILDIRIM_TURLERI.ONERI_KARARI,
  BILDIRIM_TURLERI.CALISMA_ALANI_KARARI,
]);

export function epostaGonderilsinMi(tur: string): boolean {
  return EPOSTA_GONDERILEN.has(tur as BildirimTuru);
}
