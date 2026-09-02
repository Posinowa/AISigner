import "server-only";
import { prisma } from "@/lib/db";

/**
 * "Yazıyor..." sinyali (#354).
 *
 * ⚠️ NEDEN TABLO, NEDEN SÜREÇ BELLEĞİ DEĞİL:
 * Sinyal saniyeler yaşayan geçici bir veri; akla ilk gelen onu bellekte
 * tutmak. #329'da tam olarak bu elenmişti: sistem çok instance çalışıyor,
 * A pod'una yazan kullanıcının sinyali B pod'una bağlı karşı tarafa asla
 * ulaşmaz — ve bu hiçbir yerde hata olarak görünmez, sadece özellik
 * kullanıcıların bir kısmında sessizce çalışmaz.
 *
 * ⚠️ YAZMA YÜKÜ SATIR BİRİKTİRMEZ. Bileşik birincil anahtar `(from, to)`
 * sayesinde aktif yazan biri hep AYNI satırı güncelliyor: bir dakika kesintisiz
 * yazmak ~20 UPDATE üretir ama tabloya 1 satır ekler. Mesaj tablosunun aksine
 * bu veri kalıcı değil; süresi dolanlar fırsatçı olarak siliniyor.
 */

/**
 * Sinyalin tazelik süresi.
 *
 * İstemci ~3 sn'de bir yeniliyor; pencere bunun iki katından biraz fazla
 * olmalı ki tek bir gecikmiş istek göstergeyi titretmesin. Öte yandan uzun
 * tutulamaz: sekmesini kapatan kullanıcı bu süre boyunca "yazıyor" görünür.
 */
export const TAZELIK_MS = 7000;

/** Fırsatçı temizlik olasılığı — `rate-limit.ts` deseni. */
const TEMIZLIK_OLASILIGI = 0.05;

/**
 * "X yazıyor" sinyalini tazeler.
 *
 * ⚠️ ÇAĞIRAN TARAF ERİŞİMİ ÖNCEDEN DOĞRULAMALI (`verifyConversationAccess`).
 * Bu fonksiyon yetki bilmiyor; doğrulamasız çağrılırsa herkesin herkese
 * sinyal göndermesine izin verirdi.
 */
export async function yaziyorIsaretle(fromUserId: string, toUserId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + TAZELIK_MS);

  await prisma.typingSignal.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    create: { fromUserId, toUserId, expiresAt },
    update: { expiresAt },
  });

  await firsatciTemizlik();
}

/**
 * Sinyali hemen siler.
 *
 * Süre dolmasını beklemek yeterli OLMAZDI: mesajı gönderen kişi hâlâ birkaç
 * saniye "yazıyor" görünürdü ki bu, göstergenin en çok yanlış hissettiği an.
 */
export async function yaziyorDurdur(fromUserId: string, toUserId: string): Promise<void> {
  await prisma.typingSignal
    .delete({ where: { fromUserId_toUserId: { fromUserId, toUserId } } })
    .catch(() => {
      // Zaten yoksa sorun değil — durdurmak idempotent olmalı.
    });
}

/**
 * Verilen kullanıcılara şu an kimlerin yazdığını döner.
 *
 * TEK sorgu: #329'un "maliyet bağlı kullanıcı sayısından bağımsız" sözü
 * burada da korunuyor.
 *
 * @returns alıcı userId → ona yazanların kimlikleri
 */
export async function yazanlariGetir(userIdler: string[]): Promise<Map<string, string[]>> {
  const sonuc = new Map<string, string[]>();
  if (userIdler.length === 0) return sonuc;

  const satirlar = await prisma.typingSignal.findMany({
    // Süresi dolmuş satır DIŞLANIR: temizlik fırsatçı olduğu için tabloda
    // ölü satır bulunabilir; göstergeyi süre belirler, satırın varlığı değil.
    where: { toUserId: { in: userIdler }, expiresAt: { gt: new Date() } },
    select: { fromUserId: true, toUserId: true },
  });

  for (const s of satirlar) {
    const mevcut = sonuc.get(s.toUserId);
    if (mevcut) mevcut.push(s.fromUserId);
    else sonuc.set(s.toUserId, [s.fromUserId]);
  }
  return sonuc;
}

/**
 * Süresi dolmuş sinyalleri ara sıra siler.
 *
 * Her yazmada silmek, kozmetik bir sinyal için her tuş vuruşuna bir DELETE
 * eklerdi. Zamanlanmış iş kurmak da bu boyuttaki bir veri için fazla:
 * tablo kullanıcı çifti sayısıyla sınırlı ve okuma zaten süreye bakıyor.
 */
async function firsatciTemizlik(): Promise<void> {
  if (Math.random() > TEMIZLIK_OLASILIGI) return;
  await prisma.typingSignal
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {
      // Temizlik başarısız olsa da özellik çalışır; okuma süreye bakıyor.
    });
}
