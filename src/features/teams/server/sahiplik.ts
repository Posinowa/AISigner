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
          studentProfile: {
            select: {
              id: true,
              userId: true,
              // #434: Üyenin KİŞİSEL mentörleri — OKUMA erişimi için.
              // Öncesi çekilmiyordu, dolayısıyla "bu kullanıcı üyelerden birinin
              // mentörü mü" sorusu CEVAPLANAMIYORDU.
              mentorAssignments: { select: { mentorId: true } },
            },
          },
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
    members: {
      role: string;
      studentProfile: {
        id: string;
        userId: string;
        /**
         * #434: Üyenin kişisel mentörleri — OKUMA erişimi için.
         *
         * ⚠️ ZORUNLU (opsiyonel değil) — bilinçli. Alanı
         * `ATAMA_SAHIPLIK_SELECT`'ten çıkarmak böylece DERLEME HATASI oluyor.
         * Opsiyonelken hiçbir test bunu yakalayamıyordu (mutasyon testinde
         * ölçüldü): testler nesneyi elle kuruyor, Prisma select'inden
         * geçmiyor. Seçim ile kullanımı bağlayan şey tip.
         */
        mentorAssignments: { mentorId: string }[];
      };
    }[];
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
 * Bu kullanıcı atamanın mentörü mü? — YAZMA yetkisi.
 *
 * Bireysel atamada öğrencinin kendi mentörleri (#195); TAKIM atamasında
 * yalnız TAKIMIN mentörleri.
 *
 * ⚠️ ÜYENİN KİŞİSEL MENTÖRÜ BURAYA GİRMEZ — bilinçli (#434).
 *
 * Bu docstring eskiden "üyelerin kişisel mentörleri de yetkili sayılıyor"
 * diyordu ama kod bunu YAPMIYORDU: takım atamasında `studentProfile` NULL
 * (#332), yani ilk dal hiç çalışmıyordu. Çelişki #434'te çözüldü ve karar
 * OKUMA/YAZMA AYRIMI oldu:
 *
 *   - Okuma (`erisebilirMi`): üyenin kişisel mentörü de girer — öğrencisinin
 *     işine bakamaması savunulamaz.
 *   - Yazma (bu fonksiyon): yalnız takım mentörleri. Ortak panoya yazılan her
 *     şey (adım ekleme/silme, revizyon, çalışma alanı talebi) TÜM TAKIMI
 *     etkiliyor; 4 kişilik bir takımda her üyenin 2 kişisel mentörü varsa
 *     ortak panoya 8 kişi yazabilirdi.
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
  return (
    ogrencisiMi(atama, userId) ||
    mentoruMu(atama, userId) ||
    uyeninKisiselMentoruMu(atama, userId)
  );
}

/**
 * Bu kullanıcı, TAKIM üyelerinden birinin kişisel mentörü mü? (#434)
 *
 * ⚠️ YALNIZ OKUMA İÇİN. `mentoruMu` bunu KAPSAMAZ; ortak panoya yazma
 * yetkisi takım mentörlerinde kalıyor (gerekçe `mentoruMu` docstring'inde).
 *
 * ⚠️ NEDEN GEREKLİ: `erisebilirMi` adım yorumlarını, teslim dosyalarını ve
 * üstlenme bilgisini kapılıyor. Bu fonksiyon olmadan, bir stajyerin kişisel
 * mentörü öğrencisinin takımda yaptığı işe BAKAMIYORDU bile — destek
 * olması imkânsızdı.
 *
 * ⚠️ AYRILMIŞ ÜYE KAPSAM DIŞI: `ATAMA_SAHIPLIK_SELECT` üyeleri zaten
 * `leftAt: null` ile sınırlıyor (#332).
 */
export function uyeninKisiselMentoruMu(
  atama: SahiplikliAtama,
  userId: string | null | undefined,
): boolean {
  // Boş/eksik kimlik kontrolü `isAssignedMentor`'da (o da null userId'yi
  // reddediyor); burada tekrarlamak ölü mantık olurdu — mutasyon testinde
  // ölçüldü, kaldıran sürümü hiçbir test öldüremiyordu.
  return Boolean(
    atama.team?.members.some((u) =>
      isAssignedMentor(u.studentProfile.mentorAssignments, userId),
    ),
  );
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
