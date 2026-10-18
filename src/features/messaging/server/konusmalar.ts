import "server-only";
import { prisma } from "@/lib/db";

/**
 * Kullanıcının konuşma listesi (`/api/messages/conversations`).
 *
 * Route yalnız yetki ve HTTP ile ilgilenir; partner seçimi ve son mesaj/okunmamış
 * toplaması burada. Böylece kural değişikliği (ör. yeni bir bağ türü) tek yerde
 * yapılır ve route'a veritabanı sorgusu sızmaz.
 */

export type KonusmaPartneri = {
  id: string;
  name: string | null;
  lastName: string | null;
  role: string;
};

export type KonusmaOzeti = {
  partner: KonusmaPartneri;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: Date;
    isRead: boolean;
  } | null;
  unreadCount: number;
};

type SonMesajSatiri = {
  partnerId: string;
  id: string;
  content: string;
  senderId: string;
  createdAt: Date;
  isRead: boolean;
};

/**
 * Kullanıcının konuşma partnerleri (role göre).
 *
 * ADMIN: herkes. MENTOR: atandığı öğrenciler (bireysel + takım) + ADMIN'ler.
 * STUDENT: mentorları (bireysel + aktif takım) + ADMIN'ler.
 */
export async function konusmaPartnerleri(
  userId: string,
  userRole: string | undefined,
): Promise<KonusmaPartneri[]> {
  let conversationPartners: KonusmaPartneri[] = [];

  if (userRole === "ADMIN") {
    // Admin: tüm kullanıcılar (kendisi hariç)
    const users = await prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true, name: true, lastName: true, role: true },
      orderBy: { createdAt: "desc" },
    });
    conversationPartners = users;
  } else if (userRole === "MENTOR") {
    // #195: M:N — bu mentörün atandığı öğrenciler.
    //
    // ⚠️ #370: Bağ İKİ YOLDAN gelir. Yalnız bireysel bağa bakan sürümde
    // takım üyesi bu listede HİÇ görünmüyordu; mentör mesaj gönderebilse
    // bile kime göndereceğini bulamazdı. #367'nin liste dersi burada da
    // geçerli.
    const profiles = await prisma.studentProfile.findMany({
      where: {
        OR: [
          { mentorAssignments: { some: { mentorId: userId } } },
          {
            teamMemberships: {
              some: { leftAt: null, team: { mentors: { some: { mentorId: userId } } } },
            },
          },
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, lastName: true, role: true },
        },
      },
    });
    conversationPartners = profiles.map((p) => p.user);

    // ADMIN'lerle de mesajlaşabilir
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, lastName: true, role: true },
    });
    conversationPartners = [...conversationPartners, ...admins];
  } else if (userRole === "STUDENT") {
    // #195: M:N — öğrencinin TÜM mentorları konuşma partneri olur.
    // #370: Bireysel mentörler + AKTİF takımlarının mentörleri.
    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        mentorAssignments: {
          include: {
            mentor: {
              select: { id: true, name: true, lastName: true, role: true },
            },
          },
        },
        teamMemberships: {
          where: { leftAt: null },
          include: {
            team: {
              include: {
                mentors: {
                  include: {
                    mentor: {
                      select: { id: true, name: true, lastName: true, role: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (profile) {
      const takimMentorleri = profile.teamMemberships.flatMap((u) =>
        u.team.mentors.map((m) => m.mentor),
      );
      // Aynı mentör hem bireysel hem takım üzerinden gelebilir — tekilleştir,
      // yoksa listede iki kez görünürdü.
      const hepsi = [...profile.mentorAssignments.map((a) => a.mentor), ...takimMentorleri];
      conversationPartners = [...new Map(hepsi.map((m) => [m.id, m])).values()];
    }

    // ADMIN'lerle de mesajlaşabilir
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, lastName: true, role: true },
    });
    conversationPartners = [...conversationPartners, ...admins];
  }

  return conversationPartners;
}

/**
 * Her partner için son mesaj ve okunmamış sayısı; son mesaja göre sıralı.
 *
 * PERFORMANS (N+1 giderildi): partner sayısından BAĞIMSIZ olarak iki sorgu:
 *   1) partner başına son mesaj  → Postgres `DISTINCT ON`
 *   2) partner başına okunmamış  → tek `groupBy`
 * ADMIN için partner listesi tüm kullanıcılar olabildiğinden, partner başına
 * sorgu havuzu tıkardı.
 */
export async function konusmaOzetleri(
  userId: string,
  conversationPartners: KonusmaPartneri[],
): Promise<KonusmaOzeti[]> {
  const partnerIdleri = conversationPartners.map((p) => p.id);

  // DISTINCT ON: her partner için yalnızca en yeni satırı döndürür. Prisma'nın
  // sorgu kurucusunda karşılığı yok, bu yüzden ham SQL. Parametreler
  // $queryRaw ile bağlanıyor (SQL enjeksiyonu yok) — şablon literali
  // interpolasyonu Prisma tarafından parametreye çevriliyor.
  const sonMesajlar =
    partnerIdleri.length === 0
      ? []
      : await prisma.$queryRaw<SonMesajSatiri[]>`
          SELECT DISTINCT ON ("partnerId")
                 "partnerId", "id", "content", "senderId", "createdAt", "isRead"
          FROM (
            SELECT CASE WHEN "senderId" = ${userId} THEN "receiverId" ELSE "senderId" END AS "partnerId",
                   "id", "content", "senderId", "createdAt", "isRead"
            FROM "Message"
            WHERE "senderId" = ${userId} OR "receiverId" = ${userId}
          ) AS konusmalar
          WHERE "partnerId" = ANY(${partnerIdleri})
          ORDER BY "partnerId", "createdAt" DESC
        `;

  // Okunmamışlar: gönderene göre tek gruplama. @@index([receiverId, isRead])
  // bu sorguyu doğrudan karşılıyor.
  const okunmamisGruplari =
    partnerIdleri.length === 0
      ? []
      : await prisma.message.groupBy({
          by: ["senderId"],
          where: { receiverId: userId, isRead: false, senderId: { in: partnerIdleri } },
          _count: { _all: true },
        });

  const sonMesajHaritasi = new Map(sonMesajlar.map((m) => [m.partnerId, m]));
  const okunmamisHaritasi = new Map(
    okunmamisGruplari.map((g) => [g.senderId, g._count._all]),
  );

  // Hiç mesajlaşılmamış partnerler de listede kalmalı (lastMessage: null) —
  // admin/mentör yeni bir konuşma başlatabilsin.
  const conversations: KonusmaOzeti[] = conversationPartners.map((partner) => {
    const satir = sonMesajHaritasi.get(partner.id);
    return {
      partner,
      lastMessage: satir
        ? {
            id: satir.id,
            content: satir.content,
            senderId: satir.senderId,
            createdAt: satir.createdAt,
            isRead: satir.isRead,
          }
        : null,
      unreadCount: okunmamisHaritasi.get(partner.id) ?? 0,
    };
  });

  // Son mesaja göre sırala (en son mesajı olan en üstte)
  conversations.sort((a, b) => {
    if (!a.lastMessage && !b.lastMessage) return 0;
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
  });

  return conversations;
}
