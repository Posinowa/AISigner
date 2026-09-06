/**
 * Taslak yol haritasının mentöre nasıl anlatılacağı (#405).
 *
 * Saf modül — veri çekmiyor, sunucuya bağlı değil; hem sunucu bileşenlerinden
 * hem istemciden kullanılabilsin diye.
 *
 * ⚠️ SORUN DURUMUN GÖRÜNMEMESİ DEĞİL, SONUCUNUN SÖYLENMEMESİYDİ.
 *
 * Yol haritası sayfasında zaten sarı bir "Taslak" rozeti vardı. Eksik olan iki
 * şey:
 *
 *  1. Rozet "Taslak" diyor ama "stajyer hiçbir adımı göremiyor" demiyordu;
 *     durum ile sonucu arasındaki bağı mentör kendi kurmak zorundaydı.
 *  2. Asıl körlük sayfanın DIŞINDAYDI: mentör panosunda ve öğrenci detayında
 *     hiçbir işaret yoktu. Öğrenci detayı üstelik taslak bir rotaya
 *     "AI Rotası HAZIR" diyordu — gerçeğin tersi.
 *
 * Metin tek yerde: üç yüzeyde farklı sözcük kullanmak, aynı durumu farklı
 * şeyler sanmaya yol açardı.
 */

/** Yol haritası durumu — şemadaki `RoadmapStatus` ile aynı değerler. */
export type YolHaritasiDurumu = "DRAFT" | "PUBLISHED" | string;

export function taslakMi(durum: YolHaritasiDurumu | null | undefined): boolean {
  return durum === "DRAFT";
}

/** Kısa rozet metni — proje satırlarında, dar alanda. */
export const TASLAK_ROZETI = "Taslak — yayında değil";

/** Sonucu söyleyen cümle. Rozetin yanında ya da ipucu olarak kullanılır. */
export const TASLAK_SONUCU =
  "Stajyer bu yol haritasının adımlarını göremiyor. Görebilmesi için yayınlamanız gerekiyor.";

/**
 * Panodaki özet uyarısı.
 *
 * Sayı 0 ise `null` döner: "0 taslak var" demek gürültüdür.
 *
 * ⚠️ Uyarı ENGELLEYİCİ DEĞİL. Düzenleme sırasında taslağa geri almak meşru
 * bir işlem; amaç mentörü durdurmak değil, unutmasını engellemek.
 */
export function taslakUyarisi(adet: number): string | null {
  if (adet <= 0) return null;
  return adet === 1
    ? "1 yol haritası taslakta — stajyeriniz adımları henüz göremiyor."
    : `${adet} yol haritası taslakta — stajyerleriniz adımları henüz göremiyor.`;
}
