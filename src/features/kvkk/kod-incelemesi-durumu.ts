import "server-only";
import { prisma } from "@/lib/db";
import { RIZA_METIN_SURUMU } from "./riza";

/**
 * Bir atamada AI kod incelemesinin AÇIK OLUP OLMADIĞI ve nedeni (#394).
 *
 * ⚠️ KURAL DEĞİŞMİYOR, GÖRÜNÜR OLUYOR. `pr-inceleme.ts` takım deposunda
 * HERKESİN güncel rızasını arıyor: ortak repoda bir PR'ın hangi satırını
 * kimin yazdığı bilinmiyor (GitHub kullanıcısı ↔ platform kullanıcısı
 * eşlemesi #326'da bilerek ertelendi). Rıza vermemiş üyenin kodu diff'e
 * karışmış olabilir; "PR'ı açan rıza verdi" yeterli dayanak değil.
 *
 * Eksik olan şey kuralın kendisi değil, SESSİZLİĞİ: engelleme hiç kimseye
 * söylenmiyordu. Sayaç artıyor (`ai.code-review.riza-yok`) ama o yalnızca
 * teşhis. #328'in "eleme SESSİZ DEĞİL" ilkesi burada uygulanmamıştı.
 *
 * ⚠️ MENTÖRE KİMİN EKSİK OLDUĞU YAZILIYOR, ÖĞRENCİLERE DEĞİL. Durumu
 * düzeltebilecek kişi rıza vermemiş üye, ama onu takip edebilecek kişi
 * mentör. Üyeler arasında isim paylaşmak baskı yaratır ve rıza "özgür
 * iradeyle" verilmiş olmaktan çıkardı (#352 gerekçesi); mentör ise zaten
 * öğrencinin sorumlusu.
 *
 * ⚠️ `guncelRizaVar` semantiği: kod incelemesi rızanın KAPSAMINI genişletti
 * (#327), bu yüzden yürürlükteki metin şart. Eski sürüme rıza vermiş üye
 * sohbetini ve analizini kaybetmez, yalnız kod incelemesi almaz.
 */

export type KodIncelemesiDurumu = {
  acikMi: boolean;
  /** Güncel rızası olmayan üyeler — YALNIZ mentör/admin yüzeyinde gösterilir. */
  rizasiEksikler: { userId: string; ad: string }[];
  /** Atamanın sahibi hiç bulunamadıysa true; inceleme yine kapalı. */
  sahipYok: boolean;
};

type RizaliKullanici = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  aiConsentAt: Date | null;
  aiConsentVersion: string | null;
};

const KULLANICI_SECIM = {
  id: true,
  name: true,
  lastName: true,
  email: true,
  aiConsentAt: true,
  aiConsentVersion: true,
} as const;

/** `guncelRizaVar` ile AYNI kural — tek yerde yazılı kalsın diye saf fonksiyon. */
export function guncelRizasiVarMi(k: {
  aiConsentAt: Date | null;
  aiConsentVersion: string | null;
}): boolean {
  return Boolean(k.aiConsentAt) && k.aiConsentVersion === RIZA_METIN_SURUMU;
}

const adiniCoz = (k: RizaliKullanici) =>
  [k.name, k.lastName].filter(Boolean).join(" ") || k.email;

export async function kodIncelemesiDurumu(
  assignmentId: string,
): Promise<KodIncelemesiDurumu> {
  const atama = await prisma.assignedProject.findUnique({
    where: { id: assignmentId },
    select: {
      studentProfile: { select: { user: { select: KULLANICI_SECIM } } },
      team: {
        select: {
          members: {
            // Ayrılmış üye artık panoyu kullanmıyor; rızası da aranmaz (#332).
            where: { leftAt: null },
            select: { studentProfile: { select: { user: { select: KULLANICI_SECIM } } } },
          },
        },
      },
    },
  });

  const kullanicilar: RizaliKullanici[] = atama?.team
    ? atama.team.members.map((m) => m.studentProfile.user)
    : atama?.studentProfile
      ? [atama.studentProfile.user]
      : [];

  // Sahibi bulunamayan atamada inceleme KAPALI: dayanağı olmayan bir rızayı
  // varsaymak yerine kapalı kabul ediliyor (`atamaninAiRizasiVar` ile aynı).
  if (kullanicilar.length === 0) {
    return { acikMi: false, rizasiEksikler: [], sahipYok: true };
  }

  const rizasiEksikler = kullanicilar
    .filter((k) => !guncelRizasiVarMi(k))
    .map((k) => ({ userId: k.id, ad: adiniCoz(k) }));

  return { acikMi: rizasiEksikler.length === 0, rizasiEksikler, sahipYok: false };
}
