import { NextResponse } from "next/server";

/**
 * #208'in "mezun yazamaz" kuralı — TEK KAYNAK.
 *
 * ⚠️ NEDEN VAR: bu kontrol yazma uçlarına **elle** kopyalanıyordu ve iki
 * farklı şekilde yazılmıştı — altı yerde `role === "STUDENT" &&
 * accountStatus === "GRADUATED"`, üç yerde rol kontrolü olmadan. Denetimde
 * **iki uçta hiç yoktu**: `steps/[stepId]/assignee` (mezun eski takımının
 * havuzundan iş çekmeye devam edebiliyordu) ve `student/proposals` POST
 * (onaylanınca atamaya dönüşen bir uç). İkisi de #438'de kapatıldı.
 *
 * Aynı körlük bu kod tabanında "bu öğrenci benim mi" sorusunda DÖRT kez
 * yaşandı (#367/#370/#393) ve çözüm aynı olmuştu: kuralı tek fonksiyona
 * hapsetmek. Burası onun mezuniyet karşılığı.
 *
 * ## Kural (#208 ayrım ilkesi)
 *
 * Mezunun portfolyosu **salt okunur**:
 * - **KAPALI** — sistem durumunu değiştiren uçlar (adım durumu, dosya,
 *   yorum, adım üstlenme, yeni proje önerisi) ve **ücretli AI** (her mesaj
 *   Gemini maliyeti + aktif staja bağlı araç).
 * - **AÇIK** — *insan iletişimi* (mesajlaşma, öneri/istek, ofis saati
 *   rezervasyonu) ve **her türlü okuma**.
 *
 * ## ⚠️ Neden `requireAuth` içine gömülmedi
 *
 * Akla ilk gelen `requireAuth`'a bir bayrak eklemekti. İki sebeple
 * yapılmadı:
 *
 * 1. **Varsayılan kapalı yapılamıyor.** Mezun panosunu, yol haritasını,
 *    dosyalarını ve sertifikasını GÖREBİLMELİ (#208). `requireAuth`
 *    okuma/yazma ayrımını bilmiyor; oraya konulan bir kapı mezunun tüm
 *    deneyimini kırardı.
 * 2. **Opt-in bayrak, elle yazılan kontrolle aynı hatayı yapar.** Bayrağı
 *    koymayı unutan yeni uç yine sessizce açık kalırdı — düzeltmeye
 *    çalıştığımız şey tam buydu.
 *
 * Bu yüzden koruma **çalışma anında değil, testte**: `mezun-politikasi.test.ts`
 * yazma uçlarını tarayıp her birinin ya bu yardımcıyı kullandığını ya da
 * gerekçesi YAZILI bir listede olduğunu doğruluyor. Unutmak kırmızı test
 * verir, sessiz bir açık değil.
 */

/** Oturumdan okunan asgari alanlar — `next-auth` tipinden bağımsız kalsın. */
type MezunKontrolOturumu = {
  user?: { role?: string; accountStatus?: string };
};

/**
 * Bu oturum "yazma yasağı" kapsamında mı?
 *
 * ⚠️ ROL DE SORULUYOR. Kapı YALNIZ stajyere ait: mentör ve admin, mezun bir
 * öğrencinin panosunu düzenlemeye devam edebilmeli. Kısıt salt-okunur
 * PORTFOLYO sahibi içindir, yönetim yetkisi için değil.
 *
 * (Rolsüz yazılan üç uç bugün `requireAuth("STUDENT")` altında olduğu için
 * davranış aynıydı; ama iki farklı şeklin yan yana durması sapmanın
 * kaynağıydı. Artık tek şekil var.)
 */
export function mezunStajyerMi(oturum: MezunKontrolOturumu | null | undefined): boolean {
  return (
    oturum?.user?.role === "STUDENT" && oturum.user.accountStatus === "GRADUATED"
  );
}

/**
 * Yazma uçları için kapı.
 *
 * Engellenmesi gerekiyorsa hazır bir **403** yanıtı, gerekmiyorsa `null`
 * döner — çağıran taraf `if (x) return x;` deyip geçer.
 *
 * @param mesaj Kullanıcıya gösterilecek cümle. Uca özel yazılmalı: "mezun
 *   öğrenciler yorum ekleyemez" ile "adım üstlenemez" farklı şeyler ve
 *   tek bir jenerik metin kullanıcıya ne yapamadığını söylemez.
 */
export function mezunYazmaKapisi(
  oturum: MezunKontrolOturumu | null | undefined,
  mesaj: string,
): NextResponse | null {
  if (!mezunStajyerMi(oturum)) return null;
  return NextResponse.json({ error: mesaj }, { status: 403 });
}
