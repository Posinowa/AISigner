import { Prisma } from "@prisma/client";
import { ogrenciMentoreBagliSql } from "@/features/teams/server/sahiplik-sql";
import { prisma } from "@/lib/db";
import { kategoriKosulu, aramaKosulu, type KullaniciKategorisi, type KullaniciSayilari } from "@/features/admin/kategoriler";

export type { KullaniciSayilari };

// Type export
export type UserWithProfile = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  accountStatus: "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED";
  // #259: Doğrulama tarihi (#247 ile doluyor). Dolu = doğrulanmış hesap.
  // Tarih hassas bilgi değil; admin zaten e-postayı görüyor.
  emailVerified: Date | null;
  // #265: Fotoğrafın depolama adı; arayüz yalnızca varlığına bakıyor.
  avatarFile: string | null;
  studentProfile?: {
    id: string;
    experienceLevel?: string | null;
    interests: string[];
    // #195: M:N — öğrenciye atanmış mentorlar (0..n).
    mentors: { id: string; name: string | null; lastName: string | null }[];
  } | null;
};

// ------------------------------------
// Kullanıcı listesi — SAYFALI, sunucuda filtreli/aranan
//
// Önceden `getAllUsers()` TÜM kullanıcıları tek seferde çekiyordu ve
// arayüz aramayı, sekme filtresini ve 11 sayaç değerini o listeden
// hesaplıyordu. Kullanıcı sayısı büyüdükçe hem yanıt hem DOM (tablo
// sanallaştırılmıyor) doğrusal büyüyordu.
//
// ⚠️ SAYFALAMA TEK BAŞINA YETMEZDİ. Naif bir `take` üç şeyi birden sessizce
// bozardı: arama yalnız yüklü sayfayı tarardı, sekme filtresi yalnız yüklü
// sayfayı süzerdi ve panelin sayaçları "yüklenmiş kadarını" gösterirdi.
// Bu yüzden üçü de sunucuya taşındı; sayaçlar AYRI ve TOPLU sorgudan
// geliyor, yani sayfadan bağımsız DOĞRU.

/** Sayfa başına varsayılan kayıt. */
export const SAYFA_BOYUTU = 50;

export type KullaniciListesi = {
  users: UserWithProfile[];
  /** Sonraki sayfanın imleci; yoksa liste bitti. */
  nextCursor: string | null;
};

const LISTE_SELECT = {
  id: true,
  email: true,
  name: true,
  lastName: true,
  role: true,
  accountStatus: true,
  emailVerified: true,
  avatarFile: true,
  studentProfile: {
    select: {
      id: true,
      experienceLevel: true,
      interests: true,
      // #195: M:N — atanmış mentorların özet bilgisi (hash sızmaz).
      mentorAssignments: {
        select: {
          mentor: { select: { id: true, name: true, lastName: true } },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

/**
 * Kullanıcıları sayfalı getirir.
 *
 * NOT: Explicit select kullanılır — password hash gibi hassas alanlar
 * hiçbir zaman API response'una sızmamalı (include tüm scalar alanları
 * döndürürdü).
 *
 * ⚠️ SIRALAMA İKİ ALANLI: `createdAt desc, id desc`. Yalnız `createdAt`
 * ile sıralamak aynı saniyede oluşmuş kayıtlarda (seed, toplu içe aktarma)
 * kararsız sıra üretir ve imleçli sayfalamada satır ATLANMASINA ya da
 * TEKRARLANMASINA yol açar. `id` ikincil anahtar sırayı toplam hale
 * getiriyor.
 */
export async function getAllUsers(params?: {
  kategori?: KullaniciKategorisi;
  q?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<KullaniciListesi> {
  const limit = Math.min(Math.max(params?.limit ?? SAYFA_BOYUTU, 1), 200);
  const arama = aramaKosulu(params?.q ?? "");

  const where = {
    ...(kategoriKosulu(params?.kategori ?? "ALL") as Prisma.UserWhereInput),
    ...((arama ?? {}) as Prisma.UserWhereInput),
  };

  const satirlar = await prisma.user.findMany({
    where,
    select: LISTE_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // `limit + 1` hilesi: "daha var mı" sorusu fazladan sorgu atmadan
    // yanıtlanıyor (`suggestions.ts` ile aynı desen).
    take: limit + 1,
    ...(params?.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const dahaVar = satirlar.length > limit;
  const sayfa = dahaVar ? satirlar.slice(0, limit) : satirlar;

  return {
    // mentorAssignments[] → düz mentors[] listesine indir (UI'ın beklediği şekil).
    users: sayfa.map((u) => ({
      ...u,
      studentProfile: u.studentProfile
        ? {
            id: u.studentProfile.id,
            experienceLevel: u.studentProfile.experienceLevel,
            interests: u.studentProfile.interests,
            mentors: u.studentProfile.mentorAssignments.map((a) => a.mentor),
          }
        : u.studentProfile,
    })) as UserWithProfile[],
    nextCursor: dahaVar ? (sayfa[sayfa.length - 1]?.id ?? null) : null,
  };
}



/**
 * Panelin sayaçları — TOPLAMA VERİTABANINDA (#313 dersi).
 *
 * ⚠️ SAYAÇLAR SAYFADAN BAĞIMSIZ. Arayüz bunları önceden yüklü listeden
 * `.filter().length` ile hesaplıyordu; sayfalamayla o yaklaşım "ilk 50
 * kayıttaki mentör sayısı"nı gösterirdi ve bu HATA OLARAK GÖRÜNMEZDİ —
 * yalnız sayılar düşük çıkardı.
 *
 * ⚠️ ÜÇ SORGU, ÜÇÜ DE TOPLAMA. Satır çekilmiyor. Dokuz değer tek
 * `groupBy`'dan türüyor; kalan ikisi ayrı çünkü biri HESAPLANMIŞ bir koşul
 * (`emailVerified IS NULL`), diğeri İLİŞKİ üzerinden (`mentorAssignments`
 * boş). Kullanıcı başına sorgu N+1 üretirdi.
 */
export async function kullaniciSayilari(): Promise<KullaniciSayilari> {
  const [gruplar, dogrulanmamisCount, studentsWithoutMentor] = await Promise.all([
    prisma.user.groupBy({
      by: ["role", "accountStatus"],
      _count: { _all: true },
    }),
    prisma.user.count({ where: { emailVerified: null } }),
    prisma.user.count({
      where: {
        role: "STUDENT",
        accountStatus: "APPROVED",
        // #195: M:N — onaylı ama HİÇ mentörü olmayan öğrenciler.
        studentProfile: { mentorAssignments: { none: {} } },
      },
    }),
  ]);

  const say = (
    rol: string,
    kosul?: (durum: string) => boolean,
  ) =>
    gruplar
      .filter((g) => g.role === rol && (!kosul || kosul(g.accountStatus)))
      .reduce((t, g) => t + g._count._all, 0);

  return {
    total: gruplar.reduce((t, g) => t + g._count._all, 0),
    studentCount: say("STUDENT"),
    activeStudents: say("STUDENT", (d) => d === "APPROVED"),
    graduatedCount: say("STUDENT", (d) => d === "GRADUATED"),
    pendingCount: say("STUDENT", (d) => d === "PENDING"),
    rejectedCount: say("STUDENT", (d) => d === "REJECTED"),
    // #250: Onay bekleyen başvuru henüz "mentör" değil — sayıdan ayrılıyor.
    mentorCount: say("MENTOR", (d) => d !== "PENDING"),
    mentorBasvuruCount: say("MENTOR", (d) => d === "PENDING"),
    adminCount: say("ADMIN"),
    dogrulanmamisCount,
    studentsWithoutMentor,
  };
}

// ------------------------------------
// Sadece mentorları getir
export type MentorOzeti = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  /** Şu an gözettiği stajyer sayısı. */
  aktifOgrenci: number;
  /**
   * Mentörün kendi beyan ettiği eşzamanlı stajyer sınırı.
   *
   * `MentorProfile` yalnız başvuru akışında (#287) oluştuğu için seed veya
   * admin eliyle açılan mentörde YOK — o durumda `null`. Uydurma bir payda
   * üretmiyoruz; arayüz oran yerine yalnız sayı gösteriyor.
   */
  kapasite: number | null;
};

/**
 * Mentör listesi + ANLIK YÜK (#404).
 *
 * Admin bir stajyere mentör atarken açılır listede yalnız ad ve e-posta
 * görüyordu; kimin kaç stajyeri olduğu görünmediği için yük dağılımı
 * körlemesine yapılıyordu.
 *
 * ⚠️ TEK SORGU. Mentör başına ayrı bir sayım N+1 üretirdi.
 *
 * ⚠️ SAYIM İKİ YOLDAN BAĞI DA SORAR (`ogrenciMentoreBagliSql`, #376):
 * bireysel `MentorAssignment` VEYA takım üzerinden `TeamMentor`. Yalnız
 * ilkine bakan bir sayaç, takımı olup bireysel bağı olmayan stajyerleri
 * sessizce düşürürdü — #393'te tam olarak bu yaşandı.
 *
 * ⚠️ MEZUN VE REDDEDİLEN STAJYERLER SAYILMAZ. Kapasite EŞZAMANLI yükü
 * anlatıyor; mezun bir stajyer mentörün zamanını artık tüketmiyor. Sayarsak
 * eski mentörler kalıcı olarak "dolu" görünür ve yeni atama alamazdı.
 */
export async function getMentors(): Promise<MentorOzeti[]> {
  const satirlar = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string | null;
      lastName: string | null;
      email: string;
      aktifOgrenci: number;
      kapasite: number | null;
    }>
  >`
    SELECT
      m.id,
      m.name,
      m."lastName",
      m.email,
      mp.capacity AS "kapasite",
      (
        SELECT COUNT(DISTINCT sp.id)::int
        FROM "StudentProfile" sp
        JOIN "User" su ON su.id = sp."userId"
        WHERE su."accountStatus" NOT IN ('GRADUATED', 'REJECTED')
          AND ${ogrenciMentoreBagliSql(Prisma.sql`m.id`)}
      ) AS "aktifOgrenci"
    FROM "User" m
    LEFT JOIN "MentorProfile" mp ON mp."userId" = m.id
    WHERE m.role = 'MENTOR'
    ORDER BY m."createdAt" ASC
  `;

  return satirlar;
}

