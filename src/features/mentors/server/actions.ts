import { prisma } from "@/lib/db";
import { mentorunOgrencisiWhere } from "@/features/teams/server/sahiplik";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { kodIncelemesiDurumu } from "@/features/kvkk/kod-incelemesi-durumu";

// #58: Aynı proje aynı öğrenciye iki kez atanmaya çalışılırsa — route bunu 409'a çevirir.
export class AssignmentConflictError extends Error {
  constructor(message = "Bu proje zaten öğrenciye atanmış") {
    super(message);
    this.name = "AssignmentConflictError";
  }
}

export type StudentWithProfile = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  studentProfile: {
    id: string;
    birthYear: number | null;
    experienceLevel: string;
    interests: string[];
    goals: string | null;
    availability: string | null;
    assignedProjects: {
      id: string;
      status: string;
      projectTemplate: {
        id: string;
        title: string;
        difficulty: string;
      };
      createdAt: Date;
    }[];
    /**
     * #367/#393: Öğrencinin AKTİF takım üyelikleri.
     *
     * ⚠️ Takım atamasında `AssignedProject.studentProfileId` NULL, sahiplik
     * `teamId` üzerinde (#332). Proje sayaçları bu dalı da okumalı; yalnız
     * `assignedProjects`'e bakan sürüm takımı olup bireysel projesi olmayan
     * stajyer için "aktif projesi yok" diyordu.
     */
    teamMemberships: {
      role: string;
      team: {
        id: string;
        name: string;
        assignedProjects: { id: string; status: string }[];
      };
    }[];
  } | null;
};

// Mentor'un öğrencilerini getir
export async function getMentorStudents(mentorId: string): Promise<StudentWithProfile[]> {
  try {
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        studentProfile: {
          // #367: MENTÖRÜN ÖĞRENCİLERİ İKİ YOLDAN GELİR.
          //
          // Öncesi yalnız bireysel bağa bakıyordu. #332 ile mentör TAKIMA da
          // atanabiliyor ve takım üyeleriyle arasında bireysel bir
          // `MentorAssignment` kaydı YOK — dolayısıyla takım mentörü kendi
          // panelinde HİÇBİR ŞEY göremiyordu. Yetki katmanı doğru çalışıyordu
          // (API 200 dönüyordu), ama arayüzde takıma giden yol yoktu.
          OR: [
            // #195: M:N — bu mentörün doğrudan atandığı öğrenciler.
            { mentorAssignments: { some: { mentorId } } },
            // #332: Bu mentörün takımlarındaki AKTİF üyeler.
            {
              teamMemberships: {
                some: { leftAt: null, team: { mentors: { some: { mentorId } } } },
              },
            },
          ],
        },
      },
      // ⚠️ `include` DEĞİL `select`: `include` kullanıcının TÜM sütunlarını
      // döndürüyordu ve içinde `password` (argon2 hash) de vardı — mentör
      // panelinin JSON yanıtında istemciye kadar gidiyordu. `getAllUsers`
      // aynı sebeple zaten `select` kullanıyor; burası atlanmıştı.
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        role: true,
        accountStatus: true,
        createdAt: true,
        avatarFile: true,
        studentProfile: {
          include: {
            assignedProjects: {
              include: {
                projectTemplate: {
                  select: {
                    id: true,
                    title: true,
                    difficulty: true,
                  },
                },
                // #405: Taslak yol haritası panoda işaretlenebilsin. Takım
                // projelerinde bu alan zaten seçiliydi, bireysel projelerde
                // hiç çekilmiyordu — dolayısıyla mentör "yol haritası var mı,
                // yayında mı" sorusunu panodan yanıtlayamıyordu.
                //
                // #432: Adım durumları da geliyor — mentör öğrencisinin NEREDE
                // olduğunu panodan görebilsin. Yalnız `status` ve `updatedAt`:
                // başlık/açıklama pano için gereksiz yük.
                roadmap: {
                  select: {
                    id: true,
                    status: true,
                    steps: { select: { status: true, updatedAt: true } },
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
            // #367: Öğrencinin AKTİF takım üyelikleri — mentör panelinde
            // "bu stajyer hangi takımda, ortak projesi ne" görünsün.
            teamMemberships: {
              where: { leftAt: null },
              select: {
                role: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                    members: {
                      where: { leftAt: null },
                      select: {
                        role: true,
                        studentProfile: {
                          select: {
                            user: { select: { id: true, name: true, lastName: true, email: true } },
                          },
                        },
                      },
                    },
                    assignedProjects: {
                      select: {
                        id: true,
                        // #393: Pano sayaçları aktif/tamamlanmış ayrımı için
                        // durumu okuyor; seçilmediği için takım projeleri
                        // hiç sayılamıyordu.
                        status: true,
                        githubRepoUrl: true,
                        githubStatus: true,
                        projectTemplate: { select: { id: true, title: true } },
                        // #432: Takım projesinin ilerlemesi de panoda görünsün.
                        roadmap: {
                          select: {
                            id: true,
                            status: true,
                            steps: { select: { status: true, updatedAt: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return students;
  } catch (error) {
    // Hatayı yutup [] DÖNMÜYORUZ: aksi halde DB hatası "öğrenci yok" gibi
    // görünür. Çağıran API route'u yakalayıp 500 döner.
    logger.error("Error fetching mentor students:", error);
    throw error;
  }
}

// Tek öğrenci detayını getir (🚀 YOL HARİTASI İLİŞKİSİ BURAYA EKLENDİ)
export async function getStudentDetail(studentId: string, mentorId: string) {
  try {
    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        role: "STUDENT",
        // #370: Bağ İKİ YOLDAN gelir. #367 LİSTEYİ düzeltmişti ama burası
        // bireysel bağa bakmayı sürdürüyordu: takım mentörü üyeyi panelinde
        // görüyor, tıklayınca 404 alıyordu.
        studentProfile: mentorunOgrencisiWhere(mentorId),
      },
      // ⚠️ `include` DEĞİL `select`: `include` kullanıcının TÜM sütunlarını
      // döndürüyordu ve içinde `password` (argon2 hash) de vardı — mentör
      // panelinin JSON yanıtında istemciye kadar gidiyordu. `getAllUsers`
      // aynı sebeple zaten `select` kullanıyor; burası atlanmıştı.
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        role: true,
        accountStatus: true,
        createdAt: true,
        avatarFile: true,
        studentProfile: {
          include: {
            assignedProjects: {
              include: {
                projectTemplate: true,
                // 🚀 Bura Eklendi: Artık proje gelirken yol haritası ve adımları da gelecek
                roadmap: {
                  include: {
                    steps: {
                      orderBy: {
                        order: 'asc' // Adımları sırasına (1,2,3...) göre diz
                      }
                    }
                  }
                },
                // #349: Çalışma alanı talebinin SON durumu. Yalnız sonuncusu
                // gerekiyor — mentör ekranı "talep ettim mi, ne oldu" sorusunu
                // cevaplıyor, geçmiş dökümü değil.
                workspaceRequests: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    status: true,
                    adminNote: true,
                    createdAt: true,
                    decidedAt: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
            // #48: Detaylı AI profil analizi (varsa) — mentor kendi öğrencisininkini görür.
            profileAnalysis: true,
          },
        },
      },
    });

    if (!student) return student;

    /*
     * #394: AI KOD İNCELEMESİNİN DURUMU.
     *
     * Kural (takımda herkesin güncel rızası) doğru ve gevşetilmiyor; eksik
     * olan SESSİZLİĞİYDİ. Engelleme hiç kimseye söylenmiyordu: PR'ı açan
     * öğrenci incelemenin neden gelmediğini bilmiyor, mentör de durumu
     * göremiyordu (sayaç artıyor ama o yalnızca teşhis).
     *
     * ⚠️ Atama başına TEK sorgu; öğrencinin birkaç projesi olabilir ama
     * sayı küçük ve durum atamaya özgü (takım üyeleri farklı olabilir).
     */
    const atamalar = student.studentProfile?.assignedProjects ?? [];
    const kodIncelemesi = Object.fromEntries(
      await Promise.all(
        atamalar.map(async (a) => [a.id, await kodIncelemesiDurumu(a.id)] as const),
      ),
    );

    return { ...student, kodIncelemesi };
  } catch (error) {
    // "Bulunamadı" durumunu findFirst zaten null ile döner (exception atmaz);
    // buraya yalnızca gerçek DB hatasında düşülür → yutmak yerine rethrow.
    logger.error("Error fetching student detail:", error);
    throw error;
  }
}

// Öğrenciye proje ata
export async function assignProjectToStudent(
  studentProfileId: string,
  projectTemplateId: string,
  mentorId: string
) {
  try {
    // Önce bu mentor'un bu öğrenciyi yönetip yönetmediğini kontrol et
    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        id: studentProfileId,
        // #370: bireysel VEYA takım bağı.
        ...mentorunOgrencisiWhere(mentorId),
      },
    });

    if (!studentProfile) {
      throw new Error("Bu öğrenci size atanmamış");
    }

    // Aynı projeyi daha önce atanmış mı kontrol et (hızlı yol — kullanıcı dostu)
    const existingAssignment = await prisma.assignedProject.findFirst({
      where: {
        studentProfileId,
        projectTemplateId,
      },
    });

    if (existingAssignment) {
      throw new AssignmentConflictError();
    }

    // Projeyi ata
    const assignedProject = await prisma.assignedProject.create({
      data: {
        studentProfileId,
        projectTemplateId,
        status: "PENDING",
      },
      include: {
        projectTemplate: true,
        studentProfile: {
          include: {
            user: {
              select: {
                name: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return assignedProject;
  } catch (error) {
    // Zaten kullanıcı dostu çakışma hatası → olduğu gibi yükselt (gürültülü loglama yok).
    if (error instanceof AssignmentConflictError) {
      throw error;
    }
    // #58: Yarış koşulu — ön kontrolü aynı anda geçen iki istekten biri DB unique
    // ihlaline (P2002) düşer. Bunu da kullanıcı dostu çakışma hatasına çeviriyoruz.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AssignmentConflictError();
    }
    logger.error("Error assigning project:", error);
    throw error;
  }
}

// Proje durumunu güncelle
export async function updateProjectStatus(
  assignedProjectId: string,
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED",
  mentorId: string
) {
  try {
    // Mentor yetki kontrolü
    const assignedProject = await prisma.assignedProject.findFirst({
      where: {
        id: assignedProjectId,
        // #370: bireysel VEYA takım bağı.
        studentProfile: mentorunOgrencisiWhere(mentorId),
      },
    });

    if (!assignedProject) {
      throw new Error("Bu projeyi güncelleme yetkiniz yok");
    }

    return await prisma.assignedProject.update({
      where: {
        id: assignedProjectId,
      },
      data: {
        status,
      },
      include: {
        projectTemplate: true,
      },
    });
  } catch (error) {
    logger.error("Error updating project status:", error);
    throw error;
  }
}

// Proje atamasını sil (Geri al)
// İlerlemeyi sessizce silmemek için: aktif/tamamlanmış proje veya
// PUBLISHED roadmap varsa force=true gelmeden silmez.
export async function unassignProject(
  assignedProjectId: string,
  mentorId: string,
  force = false
) {
  // Mentor ownership + ilerleme bilgisi
  const assignedProject = await prisma.assignedProject.findFirst({
    where: {
      id: assignedProjectId,
      // #370: bireysel VEYA takım bağı.
      studentProfile: mentorunOgrencisiWhere(mentorId),
    },
    include: {
      roadmap: {
        select: {
          status: true,
          steps: { select: { status: true } },
        },
      },
    },
  });

  if (!assignedProject) {
    throw new Error("Bu projeyi silme yetkiniz yok veya proje bulunamadı");
  }

  if (!force) {
    const hasProgress = assignedProject.status !== "PENDING";
    const roadmapPublished = assignedProject.roadmap?.status === "PUBLISHED";
    const hasStepProgress =
      assignedProject.roadmap?.steps.some(
        (s) => s.status === "IN_PROGRESS" || s.status === "COMPLETED"
      ) ?? false;

    if (hasProgress || roadmapPublished || hasStepProgress) {
      const err = new Error(
        "Bu projede öğrenci ilerlemesi var. Silmek için onay gerekiyor."
      ) as Error & { code?: string };
      err.code = "REQUIRES_CONFIRMATION";
      throw err;
    }
  }

  return prisma.assignedProject.delete({
    where: { id: assignedProjectId },
  });
}