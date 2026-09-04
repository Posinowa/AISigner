/**
 * "Bu hesap durumu panoyu görebilir mi?" — TEK KAYNAK (#466).
 *
 * ⚠️ NEDEN VAR: Aynı koşul iki yerde İKİ FARKLI YAZIMLA duruyordu —
 * `middleware.ts` (`accountStatus !== "GRADUATED"`) ve öğrenci panosu
 * (`!isGraduated`). Bugün aynı şeyi söylüyorlardı; biri güncellenip diğeri
 * unutulduğunda panel, middleware'in engellemediği bir durumu engeller (ya da
 * tersi) ve bu **hata gibi görünmez**. Bu kod tabanının tekrar eden hata
 * sınıfı (#367/#370/#376/#393/#442/#449); #464'te aynısı mezun yazma
 * kuralında yaşandı.
 *
 * ⚠️ BURASI YALNIZCA "DURUM" SORUSUNU YANITLAR, rota sorusunu DEĞİL.
 * Middleware'in rota nüansları (mentör/stajyer ayrımı, REJECTED ile PENDING
 * farkı, profil tamamlama rotalarının PENDING'e açık olması — #143/#249/#287)
 * bilerek orada bırakıldı: kusur orada değildi ve güvenlik kritik bir kapıyı
 * gereksiz yere taşımak yeni bir risk olurdu.
 *
 * Saf modül: veri ÇEKMİYOR, `server-only` DEĞİL — `middleware.ts` Edge
 * runtime'da çalışıyor ve buradan import ediyor.
 */

/** Onay bekleyen ya da reddedilmiş hesabın yönlendirileceği kanonik ekran. */
export const DURUM_EKRANI = "/account-status";

/**
 * Panolara (öğrenci/mentör) erişebilecek hesap durumları.
 *
 * ⚠️ GRADUATED GÖREBİLİR. Mezunun portfolyosu salt-okunur olarak açık kalır
 * (#208); yazma kapısı ayrı bir sorudur ve `mezun-politikasi.ts`'te (#464).
 *
 * ⚠️ TANIMSIZ DURUM GEÇER. Eski jetonlarda alan bulunmayabiliyor ve
 * middleware'in önceki davranışı da buydu — burada daraltmak, alanı olmayan
 * oturumları toptan kilitlerdi.
 */
export function panoErisimineAcik(
  accountStatus: string | null | undefined,
): boolean {
  if (!accountStatus) return true;
  return accountStatus === "APPROVED" || accountStatus === "GRADUATED";
}
