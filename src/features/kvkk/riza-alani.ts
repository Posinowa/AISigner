/**
 * Rıza formunun İSTEMCİ tarafından da görülebilen sabitleri (#321).
 *
 * `riza.ts` "server-only" olduğu için (prisma içeriyor) kayıt formundan
 * import edilemez. Alan adı ve kullanıcıya gösterilen özet burada.
 */

/** Kayıt formundaki onay kutusunun alan adı. */
export const AI_RIZA_ALANI = "aiRizasi";

/** Kullanıcıya gösterilen rıza özeti. */
export const RIZA_OZETI =
  "Profil bilgilerimin ve yapay zekâ asistanına yazdığım mesajların, bana özel " +
  "analiz ve öneriler üretilmesi amacıyla Google Vertex AI (ABD) hizmetine " +
  "aktarılmasına açık rıza veriyorum.";
