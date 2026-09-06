/**
 * Takılı kalmış GitHub kurulumunun tespiti (#483).
 *
 * ⚠️ NEDEN VAR — ÖLÇÜLDÜ, VARSAYILMADI:
 *
 * Kurulum `after()` ile arka planda koşuyor (#318). Süreç yeniden başlarsa
 * (deploy, çökme) iş yarıda kalıyor ve atama `PROVISIONING`'de asılı
 * kalıyor — çünkü durumu `ERROR`'a çeken kod da o süreçle birlikte ölüyor.
 *
 * `provisioning.ts`'in docstring'i kurtarmanın "admin panelinden Tekrar
 * Dene" olduğunu söylüyordu. **O yol yoktu:**
 *
 *   1. Arayüzdeki "Tekrar Dene" düğmesi yalnız `ERROR` durumunda
 *      render ediliyor. `PROVISIONING` satırı dönen bir spinner ve
 *      HİÇBİR DÜĞME göstermiyordu.
 *   2. Düğme olsa bile kilit `notIn: ["PROVISIONING", LINKED]` ile
 *      isteği reddederdi ("kurulum zaten sürüyor").
 *   3. Arayüz `PROVISIONING` gördükçe listeyi yokluyor — yani sayfa
 *      sonsuza dek istek atmaya devam ediyordu.
 *
 * Sonuç: takılan atama arayüzden KURTARILAMIYORDU; veritabanına elle
 * müdahale gerekiyordu.
 *
 * ⚠️ Bu dosya prisma İMPORT ETMİYOR ve `server-only` DEĞİL: eşik hem
 * sunucudaki kilitte hem de arayüzün gösteriminde kullanılıyor. Sunucu
 * modülünden almak istemci paketine prisma sürüklerdi (#432/#448'deki
 * `sabitler.ts` ve `kategoriler.ts` ile aynı gerekçe).
 */

/**
 * Bir kurulumun "artık koşmuyor" sayılması için geçmesi gereken süre.
 *
 * ⚠️ CÖMERT SEÇİLDİ. `isiYurut` ARA GÜNCELLEME YAPMIYOR — başta
 * `PROVISIONING`, sonda `PROVISIONED`/`ERROR` yazıyor, arada satıra hiç
 * dokunmuyor. Yani canlı bir iş `updatedAt`'i tazelemiyor ve kısa bir eşik
 * ÇALIŞAN bir kurulumu "takılmış" sanardı. Kurulum bir depo + milestone'lar
 * + onlarca issue açıyor ve GitHub'ın yeniden deneme beklemeleri 30 sn'ye
 * kadar çıkabiliyor (provisioning.ts'te yazılı).
 *
 * 15 dakika: canlı bir işin asla ulaşamayacağı kadar uzun, admin'i saatlerce
 * bekletmeyecek kadar kısa.
 */
export const KURULUM_TAKILMA_DK = 15;

const DK_MS = 60 * 1000;

/**
 * Bu kurulum takılı mı?
 *
 * @param githubStatus atamanın güncel durumu
 * @param baslangic    `PROVISIONING`'e geçildiği an (`updatedAt`)
 * @param simdi        test edilebilirlik için; varsayılan `Date.now()`
 */
export function kurulumTakildiMi(
  githubStatus: string,
  baslangic: Date | string | null | undefined,
  simdi: Date = new Date(),
): boolean {
  if (githubStatus !== "PROVISIONING") return false;
  if (!baslangic) return false;

  const bas = baslangic instanceof Date ? baslangic : new Date(baslangic);
  // Geçersiz tarih "takıldı" saymaz: elimizde kanıt yokken kurtarmaya
  // izin vermek, koşan bir işin üstüne ikinci kurulum başlatabilirdi.
  if (Number.isNaN(bas.getTime())) return false;

  return simdi.getTime() - bas.getTime() > KURULUM_TAKILMA_DK * DK_MS;
}

/** Kilit sorgusunda kullanılacak eşik tarihi. */
export function takilmaEsigi(simdi: Date = new Date()): Date {
  return new Date(simdi.getTime() - KURULUM_TAKILMA_DK * DK_MS);
}
