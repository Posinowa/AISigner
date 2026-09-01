/**
 * Rol ve hesap durumu renklerinin TEK kaynağı (#338).
 *
 * NEDEN MERKEZİ: Renkler dört ayrı dosyada bağımsızca tanımlanmıştı ve
 * birbiriyle ÇELİŞİYORDU:
 *
 *   - mor: admin panelinde ADMIN, mesajlaşmada MENTOR
 *   - mavi: admin panelinde MENTOR, mesajlaşmada STUDENT
 *
 * Yani rozet rengi kullanıcıya güvenilir bir sinyal vermiyordu. Aynı kişiyi
 * iki ekranda iki farklı renkte görmek mümkündü.
 *
 * NEDEN MOR YOK: Marka tokenları (`globals.css` `@theme`) yalnız logo laciverti
 * (#23356c) ve logonun orta mavisi (#3e92cc). Mor hiçbir tokenda geçmiyordu;
 * bileşenlere sabit kodlandığı için sessizce yayılmıştı.
 */

export type Rol = "ADMIN" | "MENTOR" | "STUDENT";
export type HesapDurumu = "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED";

/** Açık zeminli rozet (kenarlıklı) — listelerde ve tablolarda. */
export const ROL_ROZETI: Record<Rol, { etiket: string; sinif: string }> = {
  // ADMIN mor idi. Indigo seçildi: MENTOR mavisi ve STUDENT emerald'inden
  // ayırt edilebiliyor ve CLAUDE.md'nin palet tanımında zaten var.
  ADMIN: { etiket: "Yönetici", sinif: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  MENTOR: { etiket: "Mentor", sinif: "bg-blue-50 text-blue-700 border-blue-200" },
  STUDENT: { etiket: "Öğrenci", sinif: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

/** Koyu zeminli rozet — sohbet/yorum balonlarında. */
export const ROL_ROZETI_DOLU: Record<Rol, { etiket: string; sinif: string; halka: string }> = {
  ADMIN: { etiket: "Yönetici", sinif: "bg-indigo-100 text-indigo-700", halka: "ring-indigo-200" },
  MENTOR: { etiket: "Mentor", sinif: "bg-blue-100 text-blue-700", halka: "ring-blue-200" },
  STUDENT: { etiket: "Öğrenci", sinif: "bg-emerald-100 text-emerald-700", halka: "ring-emerald-200" },
};

/**
 * Hesap durumu rozetleri.
 *
 * GRADUATED mor idi. Marka laciverti (`primary`) seçildi: #323'te mezuniyet
 * kartı da laciverte çekilmişti, rozet onunla aynı dili konuşuyor. Diğer
 * durumların anlamları korunuyor — amber "bekliyor", emerald "aktif",
 * kırmızı "reddedildi".
 */
export const DURUM_ROZETI: Record<HesapDurumu, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  GRADUATED: "bg-primary/10 text-primary border-primary/20",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

/**
 * Bilinmeyen rol için güvenli varsayılan.
 *
 * Rol string olarak geldiği yerler var (mesajlaşma uçları); tanınmayan bir
 * değerde renk seçimi patlamamalı.
 */
export function rolRozeti(rol: string) {
  return ROL_ROZETI[rol as Rol] ?? ROL_ROZETI.STUDENT;
}

export function rolRozetiDolu(rol: string) {
  return ROL_ROZETI_DOLU[rol as Rol] ?? ROL_ROZETI_DOLU.STUDENT;
}
