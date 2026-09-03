import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { epostaGonderilsinMi, type BildirimTuru } from "../turler";

/**
 * Bildirim gönderimi (#380).
 *
 * ⚠️ E-POSTA GİTMESE DE UYGULAMA İÇİ KAYIT DÜŞER.
 * `mail.ts` yapılandırma yoksa çökmüyor, `{ sent: false }` dönüyor (#241).
 * Bildirim aynı sözleşmeyi koruyor: önce satır yazılır, sonra e-posta denenir.
 * Tersi olsaydı SMTP kesintisinde bildirimler tamamen kaybolurdu.
 *
 * ⚠️ HİÇBİR DURUMDA FIRLATMAZ. Bildirim, tetikleyen işlemin (hesap onayı,
 * mentör ataması) yan etkisi; onu kırmamalı. Admin bir hesabı onaylayamıyorsa
 * sebebi bildirim tablosu olmamalı.
 */

export type BildirimGirdisi = {
  userId: string;
  tur: BildirimTuru;
  baslik: string;
  govde: string;
  /** Uygulama içi yol (ör. "/student-dashboard"). Harici URL değil. */
  link?: string | null;
  /** E-posta gönderilecekse alıcı adresi. Yoksa yalnız uygulama içi kalır. */
  eposta?: string | null;
  /**
   * #397: Bildirimin bağlı olduğu kayıt (ör. adım kimliği).
   *
   * Tekrar bildirimi önlemek için: çağıran taraf "bu kişiye bu kayıt için
   * daha önce bildirdik mi" diye sorabilsin.
   */
  refId?: string | null;
};

export async function bildirimGonder(girdi: BildirimGirdisi): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: girdi.userId,
        type: girdi.tur,
        title: girdi.baslik,
        body: girdi.govde,
        link: girdi.link ?? null,
        refId: girdi.refId ?? null,
      },
    });
  } catch (error) {
    logger.error("Bildirim kaydedilemedi", {
      userId: girdi.userId,
      tur: girdi.tur,
      error: error instanceof Error ? error.message : String(error),
    });
    // Kayıt düşmediyse e-posta da göndermiyoruz: kullanıcı e-postayı görüp
    // uygulamada karşılığını bulamazsa daha kafa karıştırıcı olur.
    return;
  }

  if (!girdi.eposta || !epostaGonderilsinMi(girdi.tur)) return;

  /*
   * ⚠️ E-POSTA GÖVDESİ ASGARİ VERİ TAŞIR (KVKK, #321).
   *
   * Detay için panele yönlendiriliyor. Kişisel veriyi e-postaya dökmek
   * gereksiz bir yayılma olurdu — e-posta kutuları bizim denetimimizde değil.
   */
  await sendMail({
    to: girdi.eposta,
    subject: `AISigner — ${girdi.baslik}`,
    text: `${girdi.govde}\n\nDetay için AISigner hesabınıza giriş yapın.`,
  });
}

/** Birden çok kişiye aynı bildirim — takım/çift taraflı olaylar için. */
export async function topluBildirimGonder(girdiler: BildirimGirdisi[]): Promise<void> {
  // Sırayla: biri patlarsa diğerleri yine denensin (her biri kendi içinde
  // hata yutuyor).
  for (const g of girdiler) await bildirimGonder(g);
}

/** Kullanıcının bildirimleri — en yeniden eskiye. */
export async function bildirimleriGetir(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
}

/** Okunmamış sayısı — rozet bunu gösteriyor. */
export async function okunmamisSayisi(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/**
 * Bildirimleri okundu işaretler.
 *
 * `userId` koşulu ZORUNLU: kimlik listesi istemciden geliyor, başkasının
 * bildirimini okundu yapmak mümkün olmamalı.
 */
export async function okunduIsaretle(userId: string, ids?: string[]): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids && ids.length > 0 ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return count;
}
