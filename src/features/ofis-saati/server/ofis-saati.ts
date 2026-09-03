import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { mentorunOgrencisiWhere } from "@/features/teams/server/sahiplik";

/**
 * Ofis saati (#398).
 *
 * Mentör bir zaman aralığı açar, sistem 20 dakikalık dilimlere böler, stajyer
 * tek tıkla rezerve eder.
 *
 * ⚠️ AI HİÇ KARIŞMIYOR — görüşme notu mentörün kendi cümleleri. Kayıt resmî ve
 * öğrenci hakkında; AI tarafından genişletilen bir cümle mentörün sözü gibi
 * durur ve öğrenci itiraz ederse kimin sözü olduğu belirsiz kalır.
 *
 * ⚠️ MEZUN (GRADUATED) STAJYER REZERVE EDEBİLİR — bilinçli karar. #208 ayrımı:
 * *sistem durumunu değiştiren* ve *ücretli AI* uçları mezuna kapalı, *insan
 * iletişimi* açık. Görüşme mesajlaşmanın eşi: referans, kariyer tavsiyesi
 * meşru sebepler. Kaynağın kıtlığı mentörün kendi kontrolünde — slotu o
 * açıyor ve iptal edebiliyor; ayrıca mezun yalnız hâlâ bağlı olduğu
 * mentörün takvimini görüyor. Mesajlaşma açıkken bunu kapatmak daha sert
 * bir kısıt olurdu.
 */

/** Bir görüşme diliminin uzunluğu. */
export const DILIM_DK = 20;

/** Tek seferde açılabilecek azami dilim — kaza eseri takvim şişmesin. */
const AZAMI_DILIM = 24;

export type SlotHatasi =
  | "gecmis-zaman"
  | "gecersiz-aralik"
  | "cok-uzun"
  | "slot-yok"
  | "dolu";

export type Sonuc<T = void> = { ok: true; veri: T } | { ok: false; neden: SlotHatasi };

/**
 * Zaman aralığını dilimlere böler.
 *
 * Saf fonksiyon: sınır davranışı test edilebilsin diye veri çekmiyor.
 *
 * Artan kısım (50 dakikalık aralıkta son 10 dakika gibi) ATILIYOR: yarım bir
 * dilim rezerve edilirse görüşme süresi sözleşmesi bozulurdu.
 */
export function dilimlereBol(baslangic: Date, bitis: Date): { baslangic: Date; bitis: Date }[] {
  const dilimler: { baslangic: Date; bitis: Date }[] = [];
  const adimMs = DILIM_DK * 60_000;

  let imlec = baslangic.getTime();
  while (imlec + adimMs <= bitis.getTime()) {
    dilimler.push({ baslangic: new Date(imlec), bitis: new Date(imlec + adimMs) });
    imlec += adimMs;
  }
  return dilimler;
}

/** Mentör yeni ofis saati aralığı açar. */
export async function slotlariAc(params: {
  mentorUserId: string;
  baslangic: Date;
  bitis: Date;
}): Promise<Sonuc<{ olusturulan: number }>> {
  if (params.bitis <= params.baslangic) return { ok: false, neden: "gecersiz-aralik" };
  // Geçmişe slot açmak, stajyerde rezerve edilemeyen satırlar bırakır.
  if (params.baslangic.getTime() < Date.now()) return { ok: false, neden: "gecmis-zaman" };

  const dilimler = dilimlereBol(params.baslangic, params.bitis);
  if (dilimler.length === 0) return { ok: false, neden: "gecersiz-aralik" };
  if (dilimler.length > AZAMI_DILIM) return { ok: false, neden: "cok-uzun" };

  const { count } = await prisma.ofisSaatiSlotu.createMany({
    data: dilimler.map((d) => ({
      mentorId: params.mentorUserId,
      baslangic: d.baslangic,
      bitis: d.bitis,
    })),
    /*
     * ⚠️ YENİDEN AÇMAK İDEMPOTENT — çift tık takvimi ikizlemesin.
     *
     * Canlı testte bulundu: "Aralık aç" iki kez çalışınca aynı mentörün
     * aynı anları için ikinci bir dizi slot oluşuyor, stajyer aynı 14:00
     * dilimini iki kez görüyordu. Tekillik artık `@@unique([mentorId,
     * baslangic])` ile VERİTABANINDA; burada hata fırlatmak yerine atlanıyor
     * çünkü mentörün 14:00–15:00'i açtıktan sonra 14:00–16:00 açması meşru
     * bir istek: çakışmayan dilimler oluşmalı, çakışanlar olduğu gibi kalmalı.
     *
     * Dönen `count` GERÇEKTEN oluşan sayı — arayüz "3 dilim açıldı" derken
     * atlananları saymamalı.
     */
    skipDuplicates: true,
  });

  logger.info("Ofis saati slotlari acildi", { mentorUserId: params.mentorUserId, count });
  return { ok: true, veri: { olusturulan: count } };
}

/** Mentörün kendi takvimi — boş ve dolu slotlar. */
export async function mentorunSlotlari(mentorUserId: string) {
  return prisma.ofisSaatiSlotu.findMany({
    where: { mentorId: mentorUserId, bitis: { gte: new Date() } },
    orderBy: { baslangic: "asc" },
    select: {
      id: true,
      baslangic: true,
      bitis: true,
      ogrenciNotu: true,
      mentorNotu: true,
      rezerveEden: { select: { id: true, name: true, lastName: true, email: true } },
    },
  });
}

/**
 * Stajyerin görebileceği slotlar.
 *
 * ⚠️ YALNIZCA KENDİ MENTÖRLERİNİN slotları — bireysel VEYA takım bağı (#370).
 * Başkasının rezervasyonu da görünmüyor; yalnız boş slotlar ve stajyerin
 * kendi rezervasyonları dönüyor.
 */
export async function ogrencininGorebilecegiSlotlar(studentUserId: string) {
  const profiller = await prisma.studentProfile.findMany({
    where: { userId: studentUserId },
    select: {
      mentorAssignments: { select: { mentorId: true } },
      teamMemberships: {
        where: { leftAt: null },
        select: { team: { select: { mentors: { select: { mentorId: true } } } } },
      },
    },
  });

  const mentorIdler = [
    ...new Set(
      profiller.flatMap((p) => [
        ...p.mentorAssignments.map((m) => m.mentorId),
        ...p.teamMemberships.flatMap((u) => u.team.mentors.map((m) => m.mentorId)),
      ]),
    ),
  ];
  if (mentorIdler.length === 0) return [];

  const slotlar = await prisma.ofisSaatiSlotu.findMany({
    where: {
      mentorId: { in: mentorIdler },
      baslangic: { gte: new Date() },
      OR: [{ rezerveEdenId: null }, { rezerveEdenId: studentUserId }],
    },
    orderBy: { baslangic: "asc" },
    select: {
      id: true,
      baslangic: true,
      bitis: true,
      rezerveEdenId: true,
      mentor: {
        select: {
          id: true,
          name: true,
          lastName: true,
          mentorProfile: { select: { gorusmeLinki: true } },
        },
      },
    },
  });

  /*
   * ⚠️ GÖRÜŞME BAĞLANTISI YALNIZ REZERVE EDİLMİŞ SLOTTA DÖNER.
   *
   * Arayüz stajyere "bağlantıyı rezervasyon sonrası görürsün" diyor; sözü
   * tutan yer SUNUCU olmalı. Önceki sürüm bağlantıyı her slotta dönüyordu:
   * mentörün kalıcı toplantı odası, rezervasyon yapmamış her stajyerin
   * eline geçiyordu — arayüz göstermese de ağ yanıtında duruyordu.
   */
  return slotlar.map((s) =>
    s.rezerveEdenId === studentUserId
      ? s
      : { ...s, mentor: { ...s.mentor, mentorProfile: null } },
  );
}

/**
 * Slotu rezerve eder.
 *
 * ⚠️ ÇİFT REZERVASYON VERİTABANINDA ENGELLENİR. Tek koşullu UPDATE:
 * id eşleşsin VE rezerveEdenId NULL olsun. İki stajyer aynı anda tıklarsa
 * yalnız biri satırı yakalar; "önce sorgula sonra yaz" bu yarışı kaybederdi
 * (#345/#349/#366 dersi: taramaya değil kısıta güven).
 */
export async function slotuRezerveEt(params: {
  slotId: string;
  studentUserId: string;
  not?: string | null;
}): Promise<Sonuc<{ slotId: string }>> {
  const slot = await prisma.ofisSaatiSlotu.findUnique({
    where: { id: params.slotId },
    select: { id: true, mentorId: true, baslangic: true },
  });
  if (!slot) return { ok: false, neden: "slot-yok" };

  const benim = await prisma.studentProfile.findFirst({
    where: { userId: params.studentUserId, ...mentorunOgrencisiWhere(slot.mentorId) },
    select: { id: true },
  });
  // Yetki yoksa da slot-yok dönüyor: başkasının takvimindeki bir slotun VAR
  // OLDUĞU bile sızmasın.
  if (!benim) return { ok: false, neden: "slot-yok" };

  if (slot.baslangic.getTime() < Date.now()) return { ok: false, neden: "gecmis-zaman" };

  const { count } = await prisma.ofisSaatiSlotu.updateMany({
    where: { id: params.slotId, rezerveEdenId: null },
    data: {
      rezerveEdenId: params.studentUserId,
      rezerveEdildiAt: new Date(),
      ogrenciNotu: params.not?.trim() || null,
    },
  });

  if (count === 0) return { ok: false, neden: "dolu" };

  logger.info("Ofis saati rezerve edildi", { slotId: params.slotId });
  return { ok: true, veri: { slotId: params.slotId } };
}

/**
 * Rezervasyonu iptal eder — slot yeniden BOŞA düşer.
 *
 * Hem stajyer hem mentör iptal edebilir; koşul kimin iptal ettiğine göre
 * daraltılıyor, böylece başkasının rezervasyonuna dokunulamıyor.
 */
export async function rezervasyonuIptalEt(params: {
  slotId: string;
  userId: string;
  rol: string;
}): Promise<Sonuc> {
  const kosul =
    params.rol === "MENTOR" || params.rol === "ADMIN"
      ? { id: params.slotId, mentorId: params.userId }
      : { id: params.slotId, rezerveEdenId: params.userId };

  const { count } = await prisma.ofisSaatiSlotu.updateMany({
    where: kosul,
    data: { rezerveEdenId: null, rezerveEdildiAt: null, ogrenciNotu: null },
  });

  if (count === 0) return { ok: false, neden: "slot-yok" };
  return { ok: true, veri: undefined };
}

/** Mentör slotu siler — yalnız BOŞ slot silinebilir. */
export async function slotuSil(params: {
  slotId: string;
  mentorUserId: string;
}): Promise<Sonuc> {
  const { count } = await prisma.ofisSaatiSlotu.deleteMany({
    // Rezerve edilmiş slotu silmek, stajyerin görüşmesini haberi olmadan
    // ortadan kaldırırdı. Önce iptal edilmeli.
    where: { id: params.slotId, mentorId: params.mentorUserId, rezerveEdenId: null },
  });

  if (count === 0) return { ok: false, neden: "slot-yok" };
  return { ok: true, veri: undefined };
}

/** Görüşme notu — mentörün KENDİ cümleleri, AI karışmıyor. */
export async function gorusmeNotuKaydet(params: {
  slotId: string;
  mentorUserId: string;
  not: string;
}): Promise<Sonuc> {
  const { count } = await prisma.ofisSaatiSlotu.updateMany({
    where: { id: params.slotId, mentorId: params.mentorUserId },
    data: { mentorNotu: params.not.trim() || null },
  });

  if (count === 0) return { ok: false, neden: "slot-yok" };
  return { ok: true, veri: undefined };
}
