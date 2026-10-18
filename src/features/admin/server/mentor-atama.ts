import { prisma } from "@/lib/db";
import { topluBildirimGonder } from "@/features/bildirim/server/bildirim";
import { BILDIRIM_TURLERI } from "@/features/bildirim/turler";
import { type KullaniciSayilari } from "@/features/admin/kategoriler";

export type { KullaniciSayilari };

// Type export
// ------------------------------------
// Mentor atama doğrulama hatası — route bunu 4xx'e çevirir (DB hatası 500 ile karışmasın).
export class AssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignmentValidationError";
  }
}

// ------------------------------------
// #195: Öğrencinin mentor LİSTESİNİ ayarla (M:N). Gelen liste "olması gereken tam
// küme"dir: listede olmayan atamalar kaldırılır, eksikler eklenir (atomik reconcile).
// Boş liste → tüm mentorlar kaldırılır. Profil yoksa oluşturulur.
// #43: Roller doğrulanır — yalnız STUDENT'a, yalnız MENTOR atanabilir.
export async function setStudentMentors(studentId: string, mentorIds: string[]) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { role: true },
  });
  if (!student) {
    throw new AssignmentValidationError("Öğrenci bulunamadı.");
  }
  if (student.role !== "STUDENT") {
    throw new AssignmentValidationError(
      "Mentor yalnızca STUDENT rolündeki kullanıcıya atanabilir.",
    );
  }

  // Tekrarları ayıkla; her ID gerçekten MENTOR mü tek sorguda doğrula.
  const uniqueMentorIds = [...new Set(mentorIds)];
  if (uniqueMentorIds.length > 0) {
    const mentors = await prisma.user.findMany({
      where: { id: { in: uniqueMentorIds }, role: "MENTOR" },
      select: { id: true },
    });
    if (mentors.length !== uniqueMentorIds.length) {
      throw new AssignmentValidationError(
        "Geçersiz mentor: yalnızca MENTOR rolündeki kullanıcılar atanabilir.",
      );
    }
  }

  // Profil yoksa oluştur (eski assignMentor davranışı korunur).
  const profile = await prisma.studentProfile.upsert({
    where: { userId: studentId },
    update: {},
    create: {
      userId: studentId,
      experienceLevel: "BEGINNER",
      interests: [],
    },
    select: { id: true },
  });

  // #380: Hangi bağların YENİ olduğunu bilmek için reconcile ÖNCESİ durum.
  const oncekiMentorIdler = new Set(
    (
      await prisma.mentorAssignment.findMany({
        where: { studentProfileId: profile.id },
        select: { mentorId: true },
      })
    ).map((m) => m.mentorId),
  );

  // Atomik reconcile: listede olmayanları sil + eksikleri ekle.
  await prisma.$transaction([
    prisma.mentorAssignment.deleteMany({
      where: {
        studentProfileId: profile.id,
        // Liste boşsa filtre yok → hepsi silinir (mentor ataması kaldırıldı).
        ...(uniqueMentorIds.length > 0 ? { mentorId: { notIn: uniqueMentorIds } } : {}),
      },
    }),
    prisma.mentorAssignment.createMany({
      data: uniqueMentorIds.map((mentorId) => ({
        studentProfileId: profile.id,
        mentorId,
      })),
      skipDuplicates: true, // aynı mentor tekrar → sessizce atla (@@unique)
    }),
  ]);

  // #380: Yalnız YENİ eklenen bağlar bildirilir (aşağıdaki yardımcıya bakın).
  const yeniMentorIdler = uniqueMentorIds.filter((id) => !oncekiMentorIdler.has(id));
  await mentorAtamaBildirimleriGonder(studentId, yeniMentorIdler);

  return { studentProfileId: profile.id, mentorIds: uniqueMentorIds };
}

/*
 * #380: Mentör ataması — stajyerin süreci gerçekten burada başlıyor.
 *
 * KARŞILIKLI: mentör de yeni öğrencisini öğreniyor. Düşük sıklıkta, yüksek
 * değerli bir bildirim; e-postaya bağlı.
 *
 * ⚠️ Yalnız YENİ eklenen bağlar bildiriliyor. Reconcile her çağrıda tüm
 * listeyi yazıyor; hepsini bildirmek, listeden tek kişi çıkarıldığında
 * kalan herkese "yeni mentör atandı" göndermek olurdu.
 */
async function mentorAtamaBildirimleriGonder(studentId: string, yeniMentorIdler: string[]) {
  if (yeniMentorIdler.length === 0) return;

  const [ogrenci, mentorlar] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { email: true, name: true, lastName: true },
    }),
    prisma.user.findMany({
      where: { id: { in: yeniMentorIdler } },
      select: { id: true, email: true, name: true, lastName: true },
    }),
  ]);

  const ad = (u: { name: string | null; lastName: string | null } | null) =>
    [u?.name, u?.lastName].filter(Boolean).join(" ") || "Kullanıcı";

  await topluBildirimGonder([
    {
      userId: studentId,
      tur: BILDIRIM_TURLERI.MENTOR_ATANDI,
      baslik: "Mentörünüz atandı",
      govde: `Size ${mentorlar.map(ad).join(", ")} mentör olarak atandı.`,
      link: "/student-dashboard",
      eposta: ogrenci?.email ?? null,
    },
    ...mentorlar.map((m) => ({
      userId: m.id,
      tur: BILDIRIM_TURLERI.MENTOR_ATANDI,
      baslik: "Yeni öğrenciniz var",
      govde: `${ad(ogrenci)} size stajyer olarak atandı.`,
      link: `/mentor-dashboard/${studentId}`,
      eposta: m.email,
    })),
  ]);
}

