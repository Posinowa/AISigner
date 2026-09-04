import type { Prisma } from "@prisma/client";
import { kurulumTakildiMi } from "@/features/github/kurulum-durumu";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { mentorErisimiWhere } from "@/features/teams/server/sahiplik";
import { ilerlemeOzetten, duraklamaMetniOzetten } from "@/features/progress/ilerleme";
import { adimOzetleriniGetir, BOS_OZET, type AdimOzeti } from "./adim-ozeti";

export type StudentAssignmentProgress = {
  assignmentId: string;
  // #332: Takım atamasında tek bir öğrenci yok — bu üçü null olabilir.
  studentId: string | null;
  studentName: string;
  studentEmail: string | null;
  experienceLevel: string | null;
  /// #332: Doluysa satır bir TAKIMI temsil eder.
  teamId: string | null;
  teamMembers: { name: string; role: string }[];
  // #195: M:N — öğrenciye atanmış mentorlar (0..n).
  // #332: Takımda mentörler takıma atanır.
  mentors: { id: string; name: string }[];
  projectTemplateId: string;
  projectTitle: string;
  projectDifficulty: string;
  assignmentStatus: string;
  githubRepoUrl: string | null;
  githubStatus: string;
  provisionedAt: Date | null;
  /**
   * #483: `PROVISIONING` ama artık koşmuyor — süreç yeniden başladığı için
   * yarıda kalmış. Arayüz bunu dönen bir spinner yerine "Tekrar Dene" olarak
   * göstermeli; aksi halde satır sonsuza dek "Kuruluyor..." kalıyor ve
   * yoklama hiç durmuyordu.
   *
   * Eşik SUNUCUDA hesaplanıyor: arayüzde tekrar yazmak, kilitteki eşikle
   * ayrışma riski demekti (kural tek kaynakta).
   */
  kurulumTakildi: boolean;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  /** #432: Durakladıysa "10 gündür hareket yok", aksi halde null. */
  duraklamaMetni: string | null;
  lastActivity: {
    title: string;
    updatedAt: Date;
  } | null;
  roadmapId: string | null;
  roadmapStatus: string | null;
};

/** Sayfa başına varsayılan kayıt (#448 ile aynı). */
export const SAYFA_BOYUTU = 50;

/** GitHub çalışma alanı durumuna göre süzme. */
export type GithubDurumFiltresi = "ALL" | "PROVISIONED" | "NOT_PROVISIONED";

/**
 * Mentör süzgeci. `"MENTORSUZ"` ayrı bir seçenek: mentörü olmayan atamalar
 * tam da gözden kaçmaması gereken satırlar (#432), filtreyle gizlenmemeli.
 */
export const MENTORSUZ = "MENTORSUZ";

export type AtamaSayaclari = {
  toplam: number;
  kurulu: number;
  kurulmamis: number;
  ortalamaIlerleme: number;
};

export type AtamaListesi = {
  atamalar: StudentAssignmentProgress[];
  /** Sonraki sayfanın imleci; null ise liste bitti. */
  nextCursor: string | null;
  /**
   * ⚠️ SAYAÇLAR SAYFADAN BAĞIMSIZ. Filtreye uyan TÜM atamalardan
   * hesaplanır — yüklenmiş sayfadan değil. #448'de aynı karar verilmişti:
   * sayfalanan bir listede istemcide sayılan sayaç "yüklenmiş kadarını"
   * gösterir ve panelin verdiği rakam sessizce yanlış olur.
   */
  sayaclar: AtamaSayaclari;
};

export type AtamaListesiParams = {
  githubDurum?: GithubDurumFiltresi;
  /** Mentör kullanıcı kimliği, `MENTORSUZ`, ya da boş (hepsi). */
  mentorId?: string | null;
  cursor?: string | null;
  limit?: number;
};

/**
 * Süzme koşulu.
 *
 * ⚠️ MENTÖR BAĞI `sahiplik.ts`'TEN GELİR (#370). "Bu atama bu mentörün mü"
 * sorusu bireysel `MentorAssignment` VEYA takım `TeamMentor` üzerinden
 * kurulur; yalnız ilkine bakan bir koşul takımı olup bireysel bağı olmayan
 * stajyerleri sessizce düşürür — bu hata sınıfı bu kod tabanında beş kez
 * yaşandı (#367/#370/#376/#393/#442). Elle yazmayın.
 */
function mentorFiltresi(params?: AtamaListesiParams): Prisma.AssignedProjectWhereInput {
  const kosullar: Prisma.AssignedProjectWhereInput[] = [];

  const mentorId = params?.mentorId ?? null;
  if (mentorId === MENTORSUZ) {
    // Ne bireysel ne takım mentörü olan atamalar.
    kosullar.push({
      AND: [
        { OR: [{ studentProfile: null }, { studentProfile: { mentorAssignments: { none: {} } } }] },
        { OR: [{ team: null }, { team: { mentors: { none: {} } } }] },
      ],
    });
  } else if (mentorId) {
    kosullar.push(mentorErisimiWhere(mentorId));
  }

  return kosullar.length > 0 ? { AND: kosullar } : {};
}

/**
 * Liste koşulu: mentör süzgeci + GitHub durumu.
 *
 * ⚠️ SAYAÇLAR BU KOŞULU KULLANMAZ, yalnız mentör kısmını kullanır. Panodaki
 * üç sekme ("Tümü" / "Repo Bekleyenler" / "Repo Açılmış") her birinin
 * sayısını AYNI ANDA gösteriyor; sayaçlara açık sekmenin durum süzgecini de
 * uygulasaydık kullanıcı "Repo Bekleyenler"e geçtiğinde diğer iki sekme
 * sıfır görünürdü.
 */
function atamaFiltresi(params?: AtamaListesiParams): Prisma.AssignedProjectWhereInput {
  const kosullar: Prisma.AssignedProjectWhereInput[] = [mentorFiltresi(params)];

  const durum = params?.githubDurum ?? "ALL";
  if (durum === "PROVISIONED") kosullar.push({ githubStatus: "PROVISIONED" });
  if (durum === "NOT_PROVISIONED") kosullar.push({ NOT: { githubStatus: "PROVISIONED" } });

  return { AND: kosullar };
}

/**
 * Admin için öğrencilerin projedeki canlı ilerleme durumunu ve atamalarını
 * SAYFALI çeker (#452).
 *
 * ⚠️ ÖNCESİNDE SAYFALAMA YOKTU. Ölçüldü (1406 atama, üretim derlemesi):
 * tek istek **1.04 MB** dönüyordu ve süre büyük ölçüde bu gövdeyi üretmeye
 * gidiyordu. Filtreler ve sayaçlar istemcideydi, yani tam listeyi indirmek
 * ZORUNLUYDU — #448'de admin kullanıcı listesinde çözülen sorunun aynısı.
 */
export async function getStudentAssignmentsProgress(
  params?: AtamaListesiParams,
): Promise<AtamaListesi> {
  // Güvenlik (#178-2): requireAuth hata FIRLATMAZ, { authorized } döndürür.
  // Dönüş değeri kontrol edilmezse kontrol işlevsizdir. provisioning.ts ile
  // birebir aynı desen — çağıran route ADMIN kontrolü yapsa da savunma-derinliği
  // için burada da açıkça reddediyoruz.
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.authorized) {
    throw new Error("Bu işlem için yönetici yetkisi gerekiyor");
  }

  const limit = Math.min(Math.max(params?.limit ?? SAYFA_BOYUTU, 1), 200);
  const where = atamaFiltresi(params);

  const satirlar = await prisma.assignedProject.findMany({
    where,
    // `limit + 1` hilesi: "daha var mı" sorusu fazladan sorgu atmadan
    // yanıtlanıyor (#448 / `suggestions.ts` ile aynı desen).
    take: limit + 1,
    ...(params?.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    include: {
      // #332: Atama bireysel VEYA takım olabilir.
      team: {
        select: {
          id: true,
          name: true,
          members: {
            where: { leftAt: null },
            select: {
              role: true,
              studentProfile: {
                select: { userId: true, user: { select: { name: true, lastName: true, email: true } } },
              },
            },
          },
          mentors: {
            select: {
              mentor: { select: { id: true, name: true, lastName: true, email: true } },
            },
          },
        },
      },
      studentProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              lastName: true,
              email: true,
            },
          },
          // #195: M:N — atanmış mentorlar.
          mentorAssignments: {
            include: {
              mentor: {
                select: { id: true, name: true, lastName: true, email: true },
              },
            },
          },
        },
      },
      projectTemplate: {
        select: {
          id: true,
          title: true,
          difficulty: true,
        },
      },
      // #452: Adımlar ARTIK ÇEKİLMİYOR. Buradan yalnız dört sayı üretiliyordu
      // (toplam, tamamlanan, son hareket, son adımın başlığı) ve adımlar
      // yanıtta hiç dönmüyordu; ölçümde istek başına 9.838 satır bu yüzden
      // hidratlanıyordu. Toplama `adim-ozeti.ts`'te, veritabanında.
      roadmap: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    // ⚠️ SIRALAMA İKİ ALANLI (#448). Yalnız `createdAt` ile sıralamak aynı
    // saniyede oluşmuş kayıtlarda (seed, toplu içe aktarma) kararsız sıra
    // üretir ve imleçli sayfalamada satır ATLANMASINA ya da TEKRARLANMASINA
    // yol açar. `id` ikincil anahtar sırayı toplam hale getiriyor.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const dahaVar = satirlar.length > limit;
  const assignments = dahaVar ? satirlar.slice(0, limit) : satirlar;

  // #452: Adım sayıları tek toplama sorgusuyla — atama başına değil,
  // TÜM sayfa için bir kez. Yol haritası olmayan atama listeye girmez.
  const ozetler = await adimOzetleriniGetir(
    assignments.map((a) => a.roadmap?.id).filter((id): id is string => Boolean(id)),
  );

  // Sayaçlar yalnız mentör kapsamına göre — sekme sayıları için (yukarı bakın).
  const sayaclar = await atamaSayaclariniGetir(mentorFiltresi(params));

  const ad = (u: { name: string | null; lastName: string | null; email: string }) =>
    [u.name, u.lastName].filter(Boolean).join(" ") || u.email;

  const atamalar = assignments.map((assignment) => {
    const takim = assignment.team;
    const studentUser = assignment.studentProfile?.user ?? null;

    // #332: Takım atamasında satır TAKIMI temsil eder. Üyelerden birini seçip
    // "öğrenci" diye göstermek yanıltıcı olurdu — pano ortak.
    const studentName = takim
      ? `${takim.name} (${takim.members.length} kişi)`
      : studentUser
        ? ad(studentUser)
        : "—";

    // #195: M:N — atanmış mentorların görünen adları.
    // #332: Takımda mentörler takıma atanır.
    const mentors = takim
      ? takim.mentors.map((m) => ({ id: m.mentor.id, name: ad(m.mentor) }))
      : (assignment.studentProfile?.mentorAssignments ?? []).map((a) => ({
          id: a.mentor.id,
          name: ad(a.mentor),
        }));

    // #432: Hesap ortak modülde — mentör panosu da aynısını kullanıyor.
    // Burada gömülü kaldığı sürece ikinci bir kopya kaçınılmazdı.
    // #452: Girdi artık adım dizisi değil, veritabanında toplanmış özet.
    const ozet: AdimOzeti =
      (assignment.roadmap && ozetler.get(assignment.roadmap.id)) || BOS_OZET;
    const { toplamAdim: totalSteps, tamamlanan: completedSteps, yuzde: progressPercentage } =
      ilerlemeOzetten(ozet);

    const lastActivity =
      ozet.sonBaslik && ozet.sonHareketAt
        ? { title: ozet.sonBaslik, updatedAt: ozet.sonHareketAt }
        : null;

    return {
      assignmentId: assignment.id,
      // #332: Takım atamasında tek bir öğrenci kimliği yok.
      studentId: assignment.studentProfile?.userId ?? null,
      studentName,
      studentEmail: studentUser?.email ?? null,
      experienceLevel: assignment.studentProfile?.experienceLevel ?? null,
      // #332: Arayüz satırın takım mı birey mi olduğunu ayırt edebilsin.
      teamId: takim?.id ?? null,
      teamMembers: takim
        ? takim.members.map((m) => ({ name: ad(m.studentProfile.user), role: m.role }))
        : [],
      mentors,
      projectTemplateId: assignment.projectTemplate.id,
      projectTitle: assignment.projectTemplate.title,
      projectDifficulty: assignment.projectTemplate.difficulty,
      assignmentStatus: assignment.status,
      githubRepoUrl: assignment.githubRepoUrl,
      githubStatus: assignment.githubStatus,
      provisionedAt: assignment.provisionedAt,
      // `updatedAt` PROVISIONING'e geçildiği an: `isiYurut` ara güncelleme
      // yapmıyor, bu yüzden "kurulum ne zaman başladı"nın temiz göstergesi.
      kurulumTakildi: kurulumTakildiMi(
        assignment.githubStatus,
        assignment.updatedAt,
      ),
      totalSteps,
      completedSteps,
      progressPercentage,
      // #432: "10 gündür hareket yok" — skor değil sinyal (#331/#397).
      duraklamaMetni: duraklamaMetniOzetten(ozet),
      lastActivity,
      roadmapId: assignment.roadmap?.id ?? null,
      roadmapStatus: assignment.roadmap?.status ?? null,
    };
  });

  return {
    atamalar,
    nextCursor: dahaVar ? (atamalar[atamalar.length - 1]?.assignmentId ?? null) : null,
    sayaclar,
  };
}

/**
 * Filtreye uyan TÜM atamaların sayaçları — sayfadan bağımsız.
 *
 * ⚠️ ORTALAMA İLERLEME JS'TE HESAPLANIYOR, BİLEREK. Yüzde formülü
 * `progress/ilerleme.ts`'te TEK yerde yazılı (#432); onu SQL'e kopyalamak
 * #376'daki "kural iki dilde yaşıyor" borcunu gereksiz yere bir kez daha
 * almak olurdu. Bunun yerine atama başına İKİ TAM SAYI çekiliyor
 * (toplam/tamamlanan) ve formül tek kaynaktan uygulanıyor — 1406 atamada
 * bu, kaldırılan 9838 adım satırının yanında ihmal edilebilir.
 */
async function atamaSayaclariniGetir(
  where: Prisma.AssignedProjectWhereInput,
): Promise<AtamaSayaclari> {
  const hepsi = await prisma.assignedProject.findMany({
    where,
    select: { githubStatus: true, roadmap: { select: { id: true } } },
  });

  const ozetler = await adimOzetleriniGetir(
    hepsi.map((a) => a.roadmap?.id).filter((id): id is string => Boolean(id)),
  );

  const toplam = hepsi.length;
  const kurulu = hepsi.filter((a) => a.githubStatus === "PROVISIONED").length;
  const yuzdeToplami = hepsi.reduce((acc, a) => {
    const ozet = (a.roadmap && ozetler.get(a.roadmap.id)) || BOS_OZET;
    return acc + ilerlemeOzetten(ozet).yuzde;
  }, 0);

  return {
    toplam,
    kurulu,
    kurulmamis: toplam - kurulu,
    ortalamaIlerleme: toplam > 0 ? Math.round(yuzdeToplami / toplam) : 0,
  };
}
