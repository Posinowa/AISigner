/**
 * Atamanın koşullu tekillik anahtarı — TEK KAYNAK (#503).
 *
 * ⚠️ NEDEN VAR: Bazı şablonlar doğası gereği tekrarlanır (herkesin yapması
 * beklenen portfolyo sitesi, birden çok kez verilebilen araştırma ödevleri).
 * Bugüne kadar `@@unique([studentProfileId, projectTemplateId])` — #58'in
 * yarış koruması — bunu imkânsız kılıyordu.
 *
 * Kısmi benzersiz indeks Prisma'da ifade edilemediği için deponun koşullu
 * tekillik deseni uygulandı (`pendingKey` — #345/#349/#366): Postgres çoklu
 * NULL'a izin verdiğinden,
 *
 *   tekrarlanamaz şablon → anahtar DOLU  → #58 koruması aynen sürer
 *   tekrarlanabilir      → anahtar NULL  → istenildiği kadar atanabilir
 *
 * ⚠️ ANAHTAR YAZMA ANINDA HESAPLANIR. Şablonun bayrağı sonradan değişirse
 * mevcut satırlar OLDUĞU GİBİ kalır — geçmiş atamaları yeniden yorumlamak,
 * kısıtı geriye dönük uygulamak (ya da geriye dönük kaldırmak) olurdu.
 *
 * ⚠️ BİÇİM MIGRATION'DAKİ BACKFILL İLE AYNI OLMALI
 * (`sp:<profil>:<şablon>` / `tm:<takım>:<şablon>`). Ayrışırsa migration'dan
 * önce ve sonra yazılan satırlar farklı uzayda tekil olur ve koruma sessizce
 * delinir — test bu biçimi kilitliyor.
 */

/** Bireysel atamanın tekillik anahtarı. */
export function bireyselTekilKey(
  studentProfileId: string,
  projectTemplateId: string,
): string {
  return `sp:${studentProfileId}:${projectTemplateId}`;
}

/** Takım atamasının tekillik anahtarı. */
export function takimTekilKey(teamId: string, projectTemplateId: string): string {
  return `tm:${teamId}:${projectTemplateId}`;
}

/**
 * Atamaya yazılacak `tekilKey` değeri.
 *
 * @returns tekrarlanabilir şablonlarda `null` — kısıt bilerek gevşetiliyor.
 */
export function atamaTekilKey(params: {
  projectTemplateId: string;
  tekrarlanabilir: boolean;
  studentProfileId?: string | null;
  teamId?: string | null;
}): string | null {
  if (params.tekrarlanabilir) return null;

  if (params.studentProfileId) {
    return bireyselTekilKey(params.studentProfileId, params.projectTemplateId);
  }
  if (params.teamId) {
    return takimTekilKey(params.teamId, params.projectTemplateId);
  }

  // #332: Atamanın sahibi TAM BİRİ olmalı (veritabanında ham CHECK olarak
  // `assigned_project_sahip_tek`). Buraya düşmek o kısıtın ihlali demektir;
  // sessizce `null` dönmek koruma yokmuş gibi davranmak olurdu.
  return null;
}
