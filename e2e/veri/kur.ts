import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";

import { bireyselTekilKey, takimTekilKey } from "../../src/features/projects/tekil-anahtar";
import {
  AKIS,
  AKIS_VERI,
  E2E_HESAPLARI,
  E2E_PAROLA,
  KIMLIK_DOSYASI,
  SEED_ADMIN,
} from "./hesaplar";

/**
 * Playwright `globalSetup` (#510): testlerin ihtiyaç duyduğu hesap
 * DURUMLARINI kurar.
 *
 * ⚠️ `@prisma/client` DOĞRUDAN import ediliyor, `@/lib/db` DEĞİL: o modül
 * `server-only` zincirine bağlı ve Playwright'ın Node bağlamında
 * çözülemiyor. Buradaki tek iş satır yazmak, uygulama kodu değil.
 *
 * ⚠️ TAMAMEN UPSERT — hiçbir satır silinmiyor, var olan hesaplara
 * dokunulmuyor. Kurulum geliştirme veritabanında da koşabiliyor ve bir
 * test kurulumunun kimsenin verisini düşürmemesi gerekiyor.
 */
/**
 * ⚠️ SOĞUK BAŞLANGIÇ ISITMASI — ölçülmüş bir kararsızlık kaynağı.
 *
 * `next start` ayağa kalktığında ilk istekler belirgin biçimde yavaş
 * (Prisma havuzu, JIT, ilk sorgular). Ölçüldü: build sonrası ilk koşuda
 * giriş testleri 20 sn sınırına dayanıp düştü, hemen ardından gelen üç
 * koşu temiz geçti. Tekrar deneme (`retries`) bilerek KAPALI olduğu için
 * bu gürültü testin kendisinde çözülmeli.
 *
 * ⚠️ Isıtma bir ŞEY GİZLEMİYOR: yalnız iki public yolu bir kez çağırıyor,
 * hiçbir iddiası yok. Uygulama gerçekten kırıksa testler yine düşer.
 */
async function sunucuyuIsit() {
  const taban = process.env.E2E_TABAN_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`;

  for (const yol of ["/api/health", "/signin"]) {
    try {
      await fetch(`${taban}${yol}`);
    } catch {
      // Sunucu henüz hazır değilse Playwright'ın kendi bekleyişi devrede.
    }
  }
}

/**
 * İş akışı verisi (`akislar.spec.ts`): bireysel proje + yol haritası, takım
 * projesi, mezun edilecek stajyer.
 *
 * ⚠️ HER KOŞUDA BAŞLANGIÇ DURUMUNA GERİ YAZILIR. Testler bu satırların
 * durumunu değiştiriyor (revizyon, tamamlama, mezuniyet); kurulum bir önceki
 * koşunun bıraktığını ezmezse ikinci koşu farklı bir başlangıçtan başlar ve
 * kırmızı, ürün hatası gibi görünür. Dokunulan satırlar yalnız `e2e-…`
 * hesaplarına ve `e2e_…` kimliklerine ait; hiçbir şey SİLİNMİYOR.
 */
async function akisVerisiniKur(prisma: PrismaClient, password: string) {
  const kullanici = async (h: { email: string; ad: string; role: "MENTOR" | "STUDENT" }) =>
    prisma.user.upsert({
      where: { email: h.email },
      update: { password, role: h.role, accountStatus: "APPROVED", emailVerified: new Date() },
      create: {
        email: h.email,
        name: h.ad,
        password,
        role: h.role,
        accountStatus: "APPROVED",
        emailVerified: new Date(),
      },
      select: { id: true },
    });

  const profil = async (userId: string) =>
    prisma.studentProfile.upsert({
      where: { userId },
      // Mezuniyet testi sertifikayı resmileştiriyor; her koşu SIFIRDAN başlasın.
      update: { certificateNumber: null, issuedAt: null },
      create: {
        userId,
        experienceLevel: "BEGINNER",
        interests: ["backend"],
        goals: "E2E iş akışı testi için oluşturulmuş profil.",
      },
      select: { id: true },
    });

  const mentor = await kullanici(AKIS.mentor);
  const a = await kullanici(AKIS.ogrenciA);
  const b = await kullanici(AKIS.ogrenciB);
  const mezun = await kullanici(AKIS.mezuniyet);
  const [profilA, profilB, profilMezun] = await Promise.all([
    profil(a.id),
    profil(b.id),
    profil(mezun.id),
  ]);

  // Bireysel bağ yalnız A ve mezun için. B'nin mentöre TEK yolu takım.
  for (const studentProfileId of [profilA.id, profilMezun.id]) {
    await prisma.mentorAssignment.upsert({
      where: { studentProfileId_mentorId: { studentProfileId, mentorId: mentor.id } },
      update: {},
      create: { studentProfileId, mentorId: mentor.id },
    });
  }

  const sablon = (title: string) =>
    prisma.projectTemplate.upsert({
      where: { title },
      update: {},
      create: {
        title,
        description: "E2E iş akışı testi için şablon.",
        difficulty: "EASY",
        track: ["e2e"],
      },
      select: { id: true },
    });
  const bireyselSablon = await sablon(AKIS_VERI.bireyselSablon);
  const takimSablon = await sablon(AKIS_VERI.takimSablon);

  // --- Bireysel proje + yayında yol haritası (revizyon / kilit testleri) ---
  const bireyselKey = bireyselTekilKey(profilA.id, bireyselSablon.id);
  const bireysel = await prisma.assignedProject.upsert({
    where: { tekilKey: bireyselKey },
    update: { status: "IN_PROGRESS" },
    create: {
      studentProfileId: profilA.id,
      projectTemplateId: bireyselSablon.id,
      status: "IN_PROGRESS",
      tekilKey: bireyselKey,
    },
    select: { id: true },
  });
  const roadmap = await prisma.roadmap.upsert({
    where: { assignedProjectId: bireysel.id },
    update: { status: "PUBLISHED" },
    create: {
      assignedProjectId: bireysel.id,
      title: `${AKIS_VERI.bireyselSablon} Yol Haritası`,
      status: "PUBLISHED",
    },
    select: { id: true },
  });
  // 1 tamamlandı (revizyona açık), 2 sürüyor (revizyona KAPALI), 3 kilitli.
  const durumlar = ["COMPLETED", "IN_PROGRESS", "TODO"] as const;
  for (const [i, id] of AKIS_VERI.adimlar.entries()) {
    const veri = {
      roadmapId: roadmap.id,
      order: i + 1,
      title: `E2E Adım ${i + 1}`,
      description: "E2E iş akışı testi adımı.",
      status: durumlar[i],
    };
    await prisma.roadmapStep.upsert({ where: { id }, update: veri, create: { id, ...veri } });
  }

  // --- Takım projesi (takım körlüğü testi) ---
  await prisma.team.upsert({
    where: { id: AKIS_VERI.takimId },
    update: { name: AKIS_VERI.takimAdi },
    create: { id: AKIS_VERI.takimId, name: AKIS_VERI.takimAdi },
  });
  for (const [studentProfileId, role] of [
    [profilA.id, "frontend"],
    [profilB.id, "backend"],
  ] as const) {
    await prisma.teamMember.upsert({
      where: { teamId_studentProfileId: { teamId: AKIS_VERI.takimId, studentProfileId } },
      update: { leftAt: null, role },
      create: { teamId: AKIS_VERI.takimId, studentProfileId, role },
    });
  }
  await prisma.teamMentor.upsert({
    where: { teamId_mentorId: { teamId: AKIS_VERI.takimId, mentorId: mentor.id } },
    update: {},
    create: { teamId: AKIS_VERI.takimId, mentorId: mentor.id },
  });
  const takimKey = takimTekilKey(AKIS_VERI.takimId, takimSablon.id);
  const takimProjesi = await prisma.assignedProject.upsert({
    where: { tekilKey: takimKey },
    update: {},
    create: {
      teamId: AKIS_VERI.takimId,
      projectTemplateId: takimSablon.id,
      status: "IN_PROGRESS",
      tekilKey: takimKey,
    },
    select: { id: true },
  });

  return { mezuniyetUserId: mezun.id, takimProjesiId: takimProjesi.id };
}

export default async function kur() {
  await sunucuyuIsit();

  const prisma = new PrismaClient();
  const password = await hash(E2E_PAROLA);

  try {
    /*
     * ⚠️ GİRİŞ SAYAÇLARI SIFIRLANIR — testin kendi kurduğu tuzak.
     *
     * `nextauth.ts` başarısız girişleri IP başına 10 dakikada 15 ile
     * sınırlıyor ve sayaç VERİTABANINDA (#322), yani koşular arasında
     * YAŞIYOR. "Yanlış şifre geçmez" testi her koşuda bütçeden bir tane
     * yiyor; art arda birkaç koşu (ya da hata ayıklama turu) limiti
     * doldurunca sonraki koşuda GİRİŞLER düşüyor ve kırmızı, ürün hatası
     * gibi görünüyor. Ölçüldü: testler tek tek yeşil, birlikte kırmızıydı.
     *
     * ⚠️ Silinen şey yalnız GİRİŞ sayaçları — diğer limitlere (AI, ofis
     * saati) dokunulmuyor; onları temizlemek testin kapsamı dışında.
     */
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "login-" } } });

    for (const hesap of E2E_HESAPLARI) {
      const kullanici = await prisma.user.upsert({
        where: { email: hesap.email },
        /*
         * ⚠️ GÜNCELLEMEDE DE DURUM YAZILIYOR. Testler durumu değiştiren
         * uçlara dokunmuyor ama bir önceki koşu ya da elle yapılan bir
         * deneme hesabı başka bir duruma taşımış olabilir; kurulumun
         * bıraktığı durum HER KOŞUDA aynı olmalı.
         */
        update: {
          password,
          role: "STUDENT",
          accountStatus: hesap.accountStatus,
          emailVerified: new Date(),
        },
        create: {
          email: hesap.email,
          name: hesap.ad,
          password,
          role: "STUDENT",
          accountStatus: hesap.accountStatus,
          emailVerified: new Date(),
        },
        select: { id: true },
      });

      if (hesap.profil) {
        await prisma.studentProfile.upsert({
          where: { userId: kullanici.id },
          update: {},
          create: {
            userId: kullanici.id,
            experienceLevel: "BEGINNER",
            interests: ["backend"],
            goals: "E2E testi için oluşturulmuş profil.",
          },
        });
      }
    }
    /*
     * ⚠️ ADMIN KİMLİĞİ TESTLERE AKTARILIYOR. Mezunun mesajlaşmasını test
     * etmek için GEÇERLİ bir alıcı gerekiyor: uydurma bir kimlik 403
     * döndürüyor (`erisim.ts` — öğrenci yalnız mentörüne ve admin'e
     * yazabilir) ve o 403, "mezun olduğu için reddedildi" ile AYIRT
     * EDİLEMEZ. Testin ölçmek istediği tam da bu ayrım.
     */
    const admin = await prisma.user.findUnique({
      where: { email: SEED_ADMIN },
      select: { id: true },
    });
    if (!admin) {
      throw new Error(
        `E2E kurulumu: ${SEED_ADMIN} bulunamadı. Önce \`npm run seed\` çalıştırın.`,
      );
    }
    const akis = await akisVerisiniKur(prisma, password);

    mkdirSync(".oturum", { recursive: true });
    writeFileSync(KIMLIK_DOSYASI, JSON.stringify({ adminId: admin.id, ...akis }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
