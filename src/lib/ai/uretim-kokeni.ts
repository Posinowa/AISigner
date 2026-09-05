/**
 * AI çıktısının ÜRETİM KÖKENİ — hangi prompt sürümü, hangi model (#494).
 *
 * ⚠️ NEDEN VAR — ÖLÇÜLDÜ: `ProfileAnalysis` ve `MentorAnalysis` kalıcı
 * saklanıyor ama hangi prompt'la üretildikleri HİÇBİR YERDE yazmıyordu;
 * yalnız `createdAt` vardı. Oysa prompt'lar ölçülebilir biçimde değişti:
 *
 *   - #390 kullanıcı metinlerini `veriBlogu` ile sarmaya başladı,
 *   - #410 `ProfileAnalysis` ve mentör yönlendirmesini prompt'a soktu
 *     (ölçüldü: test/CI geçen adım 0/7 → 5/5),
 *   - #423 geçmiş işi ekledi (ölçüldü: örtüşen adım 3/6 → 0/4).
 *
 * Her değişiklikten sonra veritabanında ESKİ prompt'la üretilmiş analizler
 * kalıyor ve hangisinin hangisi olduğu bilinemiyordu. "Bu analiz neden
 * zayıf?" sorusunun cevabı "eski sürümle üretilmiş" olabilirdi ama bunu
 * söyleyecek veri yoktu.
 *
 * ## ⚠️ SÜRÜM NE ZAMAN ARTAR
 *
 * Prompt'un ÜRETTİĞİ ÇIKTIYI DEĞİŞTİREBİLECEK her düzenlemede: yeni girdi
 * alanı, talimat değişikliği, çıktı şeması değişikliği. Yazım düzeltmesi
 * ya da yorum değişikliği sürümü artırmaz — aksi halde sürüm gürültüye
 * dönüşür ve "eski sürüm" uyarısı anlamını yitirir.
 *
 * ⚠️ Bu dosya prisma İMPORT ETMİYOR ve `server-only` DEĞİL: sürüm hem
 * yazma tarafında hem arayüzün "eski sürümle üretilmiş" işaretinde
 * kullanılıyor (#432/#448/#486 ile aynı gerekçe).
 */

/**
 * Yürürlükteki prompt sürümü.
 *
 * Tarih + sıra biçimi bilerek: `RIZA_METIN_SURUMU` (#327) ile aynı desen,
 * sıralanabilir ve ne zaman değiştiği okunur.
 */
export const PROMPT_SURUMU = "2026-09-v1";

export type UretimKokeni = {
  /** Üretim anındaki prompt sürümü. */
  uretimSurumu: string;
  /** Kullanılan model adı — sürüm aynıyken model değişebilir. */
  uretimModeli: string;
};

/**
 * Kaydedilecek köken bilgisi.
 *
 * ⚠️ MODEL ADI DA TUTULUYOR. Prompt sürümü aynı kalırken modelin
 * değişmesi (ör. gemini-2.5-flash → 3.0) çıktıyı en az prompt kadar
 * değiştirir; yalnız sürümü tutmak bu farkı görünmez kılardı.
 */
export function uretimKokeni(model: string): UretimKokeni {
  return { uretimSurumu: PROMPT_SURUMU, uretimModeli: model };
}

/**
 * Bu kayıt ESKİ bir prompt sürümüyle mi üretilmiş?
 *
 * ⚠️ `null` "eski" SAYILMAZ, "bilinmiyor" sayılır. Köken alanları
 * eklenmeden önce üretilmiş kayıtlar NULL taşıyor; onları "eski" diye
 * işaretlemek, gerçekte güncel olabilecek analizleri yeniden ürettirirdi
 * (ücretli AI çağrısı). Bilinmeyeni uydurmamak, #328/#331'in kararı.
 */
export function eskiSurumMu(uretimSurumu: string | null | undefined): boolean {
  if (!uretimSurumu) return false;
  return uretimSurumu !== PROMPT_SURUMU;
}
