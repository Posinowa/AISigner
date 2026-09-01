/**
 * KVKK açık rıza — yurt dışına AI aktarımı (#321).
 *
 * NEDEN VAR: Öğrencinin profil verisi (hedefler, ilgi alanları, deneyim) ve
 * sohbet mesajları Google Vertex AI'ya, yani ABD'ye gönderiliyor. KVKK yurt
 * dışına aktarım için AÇIK RIZA istiyor ve açık rızanın üç niteliği var:
 * belirli, bilgilendirilmiş ve AYRILABİLİR.
 *
 * Kayıt ekranındaki "Kullanım Koşulları'nı kabul etmiş olursunuz" cümlesi
 * ayrılabilirlik şartını karşılamıyordu: kullanıcı, hizmeti kullanmak için
 * zorunlu olan kabulle isteğe bağlı olması gereken AI aktarımını birlikte
 * onaylamış sayılıyordu.
 *
 * TASARIM KARARLARI:
 *
 * 1. Rıza ZORUNLU DEĞİL. Açık rıza özgür iradeyle verilmeli; vermeyen kullanıcı
 *    kayıt olamasaydı rıza özgür sayılmazdı. Rıza yoksa yalnızca AI özellikleri
 *    kapanır, platform çalışmaya devam eder.
 *
 * 2. Rıza GERİ ALINABİLİR (KVKK m.11).
 *
 * 3. METİN SÜRÜMÜ kaydediliyor. Aydınlatma metni değişirse eski rıza yeni metni
 *    kapsamaz; hangi sürüme onay verildiği ispat için gerekli.
 *
 * Bu dosya MEKANİZMAYI kurar, hukuki metni DEĞİL. Aydınlatma metninin içeriği
 * (veri sorumlusu kimliği, saklama süreleri, başvuru kanalı) bir avukat
 * tarafından yazılmalı — `/privacy` sayfasındaki TODO'lara bakın.
 */
import "server-only";
import { prisma } from "@/lib/db";

/**
 * Yürürlükteki aydınlatma metni sürümü.
 *
 * Metin değiştiğinde BU DEĞER DE ARTIRILMALI — aksi halde eski sürüme verilmiş
 * rıza, kullanıcının hiç görmediği yeni bir metni kapsıyormuş gibi görünür.
 */
export const RIZA_METIN_SURUMU = "2026-09-v1";

export { AI_RIZA_ALANI, RIZA_OZETI } from "./riza-alani";

/**
 * Kullanıcının AI işlemeye rızası var mı? false ise veri Vertex'e GİTMEMELİ.
 *
 * SÜRÜM KONTROLÜ YOK — bilinçli. Metin her güncellendiğinde mevcut tüm
 * kullanıcıların AI özellikleri kapansaydı, tek bir yazım düzeltmesi bile
 * platformu geniş çapta işlevsiz bırakırdı. Metnin KAPSAMI genişlediğinde
 * (yeni veri türü / yeni amaç) `guncelRizaVar` kullanılır.
 */
export async function aiRizasiVar(userId: string): Promise<boolean> {
  const k = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiConsentAt: true },
  });
  return Boolean(k?.aiConsentAt);
}

/**
 * Kullanıcı YÜRÜRLÜKTEKİ metne rıza vermiş mi?
 *
 * NEDEN AYRI (#327): Kod incelemesi rızanın kapsamını genişletti — artık
 * stajyerin KODU da yurt dışına gidiyor. "Profil ve mesajlarım aktarılsın"
 * diyen bir kullanıcı koduna rıza vermiş sayılamaz; açık rızanın "belirli ve
 * bilgilendirilmiş" olma şartı bunu engelliyor.
 *
 * Bu yüzden yalnızca KAPSAMI GENİŞLEYEN özellikler bunu kullanır. Mevcut
 * özellikler `aiRizasiVar` ile çalışmaya devam eder, yani eski rızası olan
 * kullanıcı sohbetini ve analizini kaybetmez; sadece kod incelemesi almaz.
 * Yeniden rıza vermek için `/api/profile/ai-riza` açık.
 */
export async function guncelRizaVar(userId: string): Promise<boolean> {
  const k = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiConsentAt: true, aiConsentVersion: true },
  });
  return Boolean(k?.aiConsentAt) && k?.aiConsentVersion === RIZA_METIN_SURUMU;
}

/**
 * Bir ÖĞRENCİ PROFİLİNİN sahibinin rızası var mı?
 *
 * Mentörün tetiklediği AI işlemleri (yol haritası, proje önerisi) için: işlemi
 * mentör başlatsa da veri ÖĞRENCİYE ait, rıza da öğrencinin.
 */
export async function profilSahibininRizasiVar(studentProfileId: string): Promise<boolean> {
  const p = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: { user: { select: { aiConsentAt: true } } },
  });
  return Boolean(p?.user?.aiConsentAt);
}

/** Rızayı kaydeder ya da geri alır. */
export async function aiRizasiniAyarla(userId: string, verildi: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: verildi
      ? { aiConsentAt: new Date(), aiConsentVersion: RIZA_METIN_SURUMU }
      : // Geri alma: sürüm de temizleniyor ki "hangi metne rıza var" sorusu
        // yanlış cevap vermesin.
        { aiConsentAt: null, aiConsentVersion: null },
  });
}
