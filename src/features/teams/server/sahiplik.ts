import "server-only";
import { isAssignedMentor } from "@/lib/auth/mentor-access";

/**
 * Atama sahipliği — bireysel VE takım (#332).
 *
 * NEDEN TEK YERDE: `AssignedProject.studentProfileId` artık nullable
 * (takım atamasında NULL, sahiplik `teamId` üzerinden). Bu, "atamanın
 * öğrencisi kim" ve "bu mentör erişebilir mi" sorularını soran 15 dosyayı
 * birden ilgilendiriyordu. Her birinin kendi zincirini yazması, ilerideki bir
 * değişikliğin 15 yerde birden unutulması demekti.
 *
 * Buradaki fonksiyonlar SAF: veriyi kendileri çekmiyor, çağıran tarafın
 * `ATAMA_SAHIPLIK_SELECT` ile çektiği şekli yorumluyor. Böylece yetki kontrolü
 * ek bir sorgu maliyeti getirmiyor.
 *
 * ⚠️ AYRILMIŞ ÜYE SAHİP DEĞİLDİR. `leftAt` dolu üye takımı göremez ama
 * katkı geçmişi durur (bkz. `TeamMember.leftAt`); bu yüzden üyelik satırları
 * silinmiyor, sorguda filtreleniyor.
 */

/**
 * Sahiplik sorularını cevaplamak için gereken asgari şekil.
 *
 * Prisma `include`'una doğrudan geçirilir; tüm çağrı yerleri AYNI parçayı
 * kullanmalı ki alan eklendiğinde tek yerden gelsin.
 */
export const ATAMA_SAHIPLIK_SELECT = {
  studentProfile: {
    select: {
      id: true,
      userId: true,
      mentorAssignments: { select: { mentorId: true } },
    },
  },
  team: {
    select: {
      id: true,
      name: true,
      // Ayrılmış üyeler sahiplik sorularına girmez.
      members: {
        where: { leftAt: null },
        select: {
          role: true,
          studentProfile: { select: { id: true, userId: true } },
        },
      },
      mentors: { select: { mentorId: true } },
    },
  },
} as const;

export type SahiplikliAtama = {
  studentProfile: {
    id: string;
    userId: string;
    mentorAssignments: { mentorId: string }[];
  } | null;
  team: {
    id: string;
    name: string;
    members: { role: string; studentProfile: { id: string; userId: string } }[];
    mentors: { mentorId: string }[];
  } | null;
};

/** Bu atama bir takıma mı ait? */
export function takimAtamasiMi(atama: SahiplikliAtama): boolean {
  return atama.team !== null;
}

/**
 * Atamanın öğrencilerinin `User.id` listesi.
 *
 * Bireysel atamada tek eleman, takımda aktif üyeler. Kutlama, analitik ve
 * bildirim gibi "bu işin öğrencileri kim" soranlar bunu kullanır.
 */
export function atamaninOgrenciIdleri(atama: SahiplikliAtama): string[] {
  if (atama.team) return atama.team.members.map((m) => m.studentProfile.userId);
  return atama.studentProfile ? [atama.studentProfile.userId] : [];
}

/** Atamanın `StudentProfile.id` listesi. */
export function atamaninProfilIdleri(atama: SahiplikliAtama): string[] {
  if (atama.team) return atama.team.members.map((m) => m.studentProfile.id);
  return atama.studentProfile ? [atama.studentProfile.id] : [];
}

/** Bu kullanıcı atamanın öğrencisi mi? (bireysel sahip ya da AKTİF takım üyesi) */
export function ogrencisiMi(atama: SahiplikliAtama, userId: string | null | undefined): boolean {
  if (!userId) return false;
  return atamaninOgrenciIdleri(atama).includes(userId);
}

/**
 * Bu kullanıcı atamanın mentörü mü?
 *
 * ETKİN MENTÖRLER = öğrencinin kendi mentörleri (#195) + TAKIMIN mentörleri.
 * Takım atamasında üyelerin kişisel mentörleri de yetkili sayılıyor: üyenin
 * mentörünün, üyesinin çalıştığı panoyu görememesi anlamsız olurdu.
 */
export function mentoruMu(atama: SahiplikliAtama, userId: string | null | undefined): boolean {
  if (!userId) return false;

  if (atama.studentProfile && isAssignedMentor(atama.studentProfile.mentorAssignments, userId)) {
    return true;
  }
  return Boolean(atama.team?.mentors.some((m) => m.mentorId === userId));
}

/** Öğrenci ya da mentör — çoğu uç için tek kapı. */
export function erisebilirMi(atama: SahiplikliAtama, userId: string | null | undefined): boolean {
  return ogrencisiMi(atama, userId) || mentoruMu(atama, userId);
}

/**
 * Prisma `where` parçası: bu mentörün eriştiği atamalar.
 *
 * Liste sorgularında kullanılır — tek tek çekip filtrelemek yerine
 * veritabanında daraltmak için.
 */
export function mentorErisimiWhere(mentorUserId: string) {
  return {
    OR: [
      { studentProfile: { mentorAssignments: { some: { mentorId: mentorUserId } } } },
      { team: { mentors: { some: { mentorId: mentorUserId } } } },
    ],
  };
}

/**
 * Prisma `where` parçası: bu mentörün öğrencileri (StudentProfile düzeyinde).
 *
 * ⚠️ BU FONKSİYON #370'İN SEBEBİ. "Bu öğrenci benim mi?" sorusu kod tabanında
 * altı ayrı yerde `mentorAssignments: { some: { mentorId } }` diye elle
 * yazılmıştı ve #332 takım mentörlüğünü eklediğinde hepsi birden eksik kaldı —
 * ama hepsi AYNI ANDA fark edilmedi:
 *
 *   #367 → liste sorgusu düzeltildi (mentör panelinde öğrenciler)
 *   #367 → öğrenci panosu düzeltildi (takım projesi görünmüyordu)
 *   #370 → mesajlaşma yetkisi + konuşma listesi
 *   #370 → öğrenci DETAY ucu — liste düzeltildikten sonra bağlantı 404 veriyordu
 *
 * Dördüncü örnekten sonra kural tek yere alındı. Yeni bir "bu öğrenci benim mi"
 * kontrolü yazmayın; buradan geçirin.
 *
 * ⚠️ AYRILMIŞ ÜYE DAHİL DEĞİL (`leftAt: null`). Satır katkı geçmişi için
 * duruyor, üyelik olarak değil.
 */
export function mentorunOgrencisiWhere(mentorUserId: string) {
  return {
    OR: [
      { mentorAssignments: { some: { mentorId: mentorUserId } } },
      {
        teamMemberships: {
          some: { leftAt: null, team: { mentors: { some: { mentorId: mentorUserId } } } },
        },
      },
    ],
  };
}

/**
 * Bu ÖĞRENCİye ait atamaları seçen `AssignedProject` koşulu (#423).
 *
 * ⚠️ `atamaOgrencininSql`'in Prisma karşılığı — ikisi birlikte
 * değişmeli (`sahiplik-sql.ts`'teki uyarının aynısı).
 *
 * ⚠️ #332'nin can alıcı noktası: takım atamasında `studentProfileId`
 * **NULL**. Yalnız eşitliğe bakan bir koşul takım projelerini komple eler ve
 * bu HATA OLARAK GÖRÜNMEZ, sadece liste eksik gelir.
 *
 * ⚠️ AYRILMIŞ ÜYE DAHİL DEĞİL (`leftAt: null`).
 */
export function ogrencininAtamalariWhere(studentProfileId: string) {
  return {
    OR: [
      { studentProfileId },
      { team: { members: { some: { studentProfileId, leftAt: null } } } },
    ],
  };
}

/**
 * AI üretimi için profil bağlamı (#332).
 *
 * Yol haritası ve issue üretimi tek bir öğrenci profili bekliyordu; takım
 * atamasında böyle bir profil YOK. Sentezleme kuralları:
 *
 * - **Seviye: EN DÜŞÜK.** Pano ortak; en yeni üyenin de takip edebilmesi
 *   gerekiyor. Ortalama almak kimseye uymayan bir seviye üretirdi.
 * - **İlgi alanları: BİRLEŞİM.** Takım farklı rollerden kuruluyor (frontend,
 *   backend, QA); kesişim almak çoğu zaman boş küme verirdi.
 * - **Hedefler: üyelerin hedefleri birleştirilir**, kimin yazdığı belirtilerek.
 *
 * ⚠️ Bu bir TAHMİN değil, açıkça tanımlanmış bir birleştirme. Kuralları
 * değiştirmek üretilen yol haritasının seviyesini değiştirir.
 */
export type AiProfilBaglami = {
  experienceLevel: string;
  interests: string[];
  goals: string | null;
};

const SEVIYE_SIRASI = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

export function enDusukSeviye(seviyeler: string[]): string {
  if (seviyeler.length === 0) return "BEGINNER";
  return seviyeler.reduce((enDusuk, s) =>
    SEVIYE_SIRASI.indexOf(s) < SEVIYE_SIRASI.indexOf(enDusuk) ? s : enDusuk,
  );
}
