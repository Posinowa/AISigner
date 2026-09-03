/**
 * Analitik eşikleri — SUNUCUYA BAĞLI OLMAYAN tek kaynak.
 *
 * ⚠️ NEDEN AYRI DOSYA (#432): Bu sabitler `server/analiz.ts` içindeydi ve o
 * dosya `server-only` + prisma çekiyor. İlerleme göstergesi istemci
 * bileşenlerinden de kullanılıyor; sabitleri oradan almak sunucu kodunu
 * istemci paketine sürüklerdi.
 *
 * ⚠️ ÜÇÜNCÜ BİR EŞİK UYDURULMADI. "Duraklamış" tanımı analitikteki (#331)
 * "sessiz öğrenci" tanımıyla AYNI olmalı; iki farklı sayı, aynı olguyu iki
 * yerde farklı tanımlamak olurdu ve kullanıcı hangi ekrana baktığına göre
 * farklı cevap alırdı.
 */

/** Bir adımın "takılmış" sayılması için geçmesi gereken gün. */
export const TAKILMA_GUN = 7;

/** Öğrencinin/atamanın "sessiz" sayılması için geçmesi gereken gün. */
export const SESSIZLIK_GUN = 10;
