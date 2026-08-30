/**
 * AI çıktısını veritabanı şemasındaki uzunluk sınırına göre kırpar.
 *
 * NEDEN VAR (#318): Şemada birkaç alan `@db.VarChar(n)` ile sınırlı
 * (`StepIssue.bodyMarkdown` 4000, analiz özetleri 2000). Model bu sınırı aşan
 * bir metin ürettiğinde PostgreSQL `String data, right truncated` fırlatıyor.
 *
 * Bunun görünen sonucu yanıltıcıydı: yazma çağrıları `try/catch` içinde
 * olduğundan uygulama ÇÖKMÜYOR, sessizce mock içeriğe düşüyordu. Yani kimse
 * hata görmüyor, öğrenci yalnızca jenerik içerik alıyordu — gerçek AI
 * çıktısından ayırt edilemeyecek şekilde.
 *
 * Kırpmak, içeriğin tamamen kaybolmasından iyidir: metnin başı korunur ve
 * kesildiği açıkça işaretlenir.
 */

/** Kesildiğini okuyucuya belli eden son ek. */
const KESIK_ISARETI = "\n\n… (içerik uzunluk sınırı nedeniyle kısaltıldı)";

/**
 * `metin`i en fazla `sinir` karaktere indirir.
 *
 * Sınır aşılmıyorsa metin AYNEN döner — normal durumda hiçbir şeye dokunulmaz.
 */
export function sinirla(metin: string, sinir: number): string {
  if (metin.length <= sinir) return metin;

  // Sınır, işaretin kendisinden kısaysa işaret sığmaz — düz kes. (Uç durum:
  // aksi halde dönen metin sınırı AŞAR ve Postgres yine "right truncated" der,
  // yani kırpma hiçbir işe yaramazdı.)
  if (sinir <= KESIK_ISARETI.length) return metin.slice(0, sinir);

  // İşaret de sınıra dahil: kırpılmış metin + işaret toplamı taşmamalı.
  return metin.slice(0, sinir - KESIK_ISARETI.length) + KESIK_ISARETI;
}

/** Şemadaki `@db.VarChar(n)` sınırları — tek kaynak. */
export const ALAN_SINIRI = {
  /** StepIssue.bodyMarkdown */
  issueBody: 4000,
  /** StepIssue.title — VarChar sınırı yok ama GitHub issue başlığı 256 ile sınırlı. */
  issueTitle: 256,
  /** ProfileAnalysis.summary / recommendedPath, MentorAnalysis.summary / idealStudentProfile */
  analizMetni: 2000,
} as const;
