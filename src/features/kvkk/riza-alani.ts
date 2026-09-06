/**
 * Rıza formunun İSTEMCİ tarafından da görülebilen sabitleri (#321).
 *
 * `riza.ts` "server-only" olduğu için (prisma içeriyor) kayıt formundan
 * import edilemez. Alan adı ve kullanıcıya gösterilen özet burada.
 */

/** Kayıt formundaki onay kutusunun alan adı. */
export const AI_RIZA_ALANI = "aiRizasi";

/**
 * Kullanıcıya gösterilen rıza özeti.
 *
 * ⚠️ BU METİN DEĞİŞİRSE `RIZA_METIN_SURUMU` da artırılmalı (bkz. `riza.ts`).
 * Aksi halde kullanıcının hiç görmediği bir kapsama rıza vermiş sayılır.
 *
 * #327'de kapsam GENİŞLETİLDİ: kod incelemesi için stajyerin GitHub'a yazdığı
 * kod da aktarılıyor. Yeni bir veri türü ve yeni bir amaç olduğundan eski
 * metne verilmiş rıza bunu KAPSAMAZ.
 */
export const RIZA_OZETI =
  "Profil bilgilerimin, yapay zekâ asistanına yazdığım mesajların ve proje " +
  "depolarıma gönderdiğim kod değişikliklerinin; bana özel analiz, öneri ve " +
  "otomatik kod incelemesi üretilmesi amacıyla Google Vertex AI (ABD) " +
  "hizmetine aktarılmasına açık rıza veriyorum.";
