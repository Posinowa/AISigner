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

/**
 * Bir ATAMANIN sahibi/sahipleri AI rızası vermiş mi? (#389)
 *
 * ⚠️ NEDEN AYRI BİR FONKSİYON: Rıza kontrolü bugüne kadar her AI çağrısının
 * YANINA ELLE yazıldı ve üç kez atlandı — #321 mekanizmayı kurdu, #352 mentör
 * başvurusundaki boşluğu kapattı, #389 GitHub kurulumundakini. Üçünde de
 * kontrol "unutulabilir" olduğu için atlandı. Atama düzeyindeki soru artık
 * tek yerden soruluyor.
 *
 * ⚠️ TAKIMDA HERKESİN RIZASI ARANIR. Üretilen içerik ORTAK panoya yazılıyor
 * ve girdi (deneyim seviyesi, yol haritası adımları) tüm üyelerden türüyor;
 * kimin katkısının hangi metne yansıdığı ayrıştırılamıyor. #332'deki PR
 * incelemesi kararının aynısı — orada da "kimin hangi satırı yazdığı
 * bilinmiyor" gerekçesiyle herkesin rızası aranıyor.
 *
 * ⚠️ SÜRÜM KONTROLÜ YOK (`aiRizasiVar`). Üretilen issue metni yol haritası
 * adımından türüyor; #327'deki "kodun da gönderilmesi" gibi bir KAPSAM
 * genişlemesi söz konusu değil. Eski rızası olan öğrenci bu özelliği
 * kaybetmemeli.
 *
 * Sahibi hiç bulunamazsa `false` döner: dayanağı olmayan bir rızayı varsaymak
 * yerine AI atlanır.
 */
export async function atamaninAiRizasiVar(assignmentId: string): Promise<boolean> {
  const atama = await prisma.assignedProject.findUnique({
    where: { id: assignmentId },
    select: {
      studentProfile: { select: { user: { select: { aiConsentAt: true } } } },
      team: {
        select: {
          members: {
            // Ayrılmış üye artık panoyu kullanmıyor; rızası da aranmaz.
            where: { leftAt: null },
            select: { studentProfile: { select: { user: { select: { aiConsentAt: true } } } } },
          },
        },
      },
    },
  });
  if (!atama) return false;

  const rizalar = atama.team
    ? atama.team.members.map((m) => Boolean(m.studentProfile.user.aiConsentAt))
    : atama.studentProfile
      ? [Boolean(atama.studentProfile.user.aiConsentAt)]
      : [];

  return rizalar.length > 0 && rizalar.every(Boolean);
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
