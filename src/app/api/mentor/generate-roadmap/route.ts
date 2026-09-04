import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ATAMA_SAHIPLIK_SELECT,
  mentoruMu,
} from "@/features/teams/server/sahiplik";
import { generateRoadmap } from "@/features/ai/server/generate-roadmap";
import { getStoredProfileAnalysis } from "@/features/ai/server/profile-analysis-store";
import { tamamlananAdimBasliklari } from "@/features/roadmap/server/gecmis";
import { AZAMI_GECMIS_ADIM } from "@/lib/ai/prompt";
import { requireAuth } from "@/lib/auth/guard";
import { generateRoadmapSchema } from "@/lib/validations/api";
import { createRateLimiter } from "@/lib/rate-limit";
import { profilSahibininRizasiVar } from "@/features/kvkk/riza";
import { rotaHatasi } from "@/lib/api-hata";

const limiter = createRateLimiter("generate-roadmap", {
  maxRequests: 5,
  windowSeconds: 60,
});

export async function POST(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const rl = await limiter.check(auth.session.user.id ?? "anonymous");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen biraz bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = generateRoadmapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { assignedProjectId } = parsed.data;

    // 2. Veritabanından atanmış projeyi ve ona bağlı öğrenci ile şablonu çekiyoruz
    const assignedProject = await prisma.assignedProject.findUnique({
      where: { id: assignedProjectId },
      include: {
        // #332: Sahiplik bireysel VEYA takım; yetki tek tanımdan gelir.
        // `generateRoadmap` TAM profili istediği için studentProfile ayrıca
        // bütünüyle çekiliyor (takım dalı aşağıda erken dönüyor).
        ...ATAMA_SAHIPLIK_SELECT,
        studentProfile: { include: { mentorAssignments: { select: { mentorId: true } } } },
        projectTemplate: true,
        roadmap: true // Zaten bir yol haritası var mı diye kontrol etmek için
      }
    });

    if (!assignedProject) {
      return NextResponse.json({ error: "Atanmış proje bulunamadı!" }, { status: 404 });
    }

    // Mentor ownership kontrolü — #195: öğrencinin mentorlarından biri mi?
    if (!mentoruMu(assignedProject, auth.session.user.id)) {
      return NextResponse.json(
        { error: "Bu proje üzerinde işlem yapma yetkiniz yok." },
        { status: 403 }
      );
    }

    // #321: KVKK açık rıza. İşlemi MENTÖR tetikliyor ama veri ÖĞRENCİYE ait —
    // rıza da öğrencinin. Rıza yoksa profil verisi Vertex AI'ya (ABD)
    // gönderilmez.
    // #332: TAKIM YOL HARİTASI ÜRETİMİ BU FAZDA YOK — bilinçli sınır.
    //
    // `generateRoadmap` tek bir öğrenci profili (seviye, ilgi alanları,
    // hedefler) bekliyor; takımda böyle tek bir profil YOK. Üyeleri birleştiren
    // bir "sentetik profil" uydurmak, üretilen yol haritasının kime göre
    // ayarlandığını belirsizleştirirdi. Birleştirme kuralları (en düşük seviye,
    // ilgi alanlarının birleşimi) `sahiplik.ts`'te tanımlı ama bu uca
    // bağlanması ayrı bir iş.
    if (assignedProject.team) {
      return NextResponse.json(
        {
          error:
            "Takım projeleri için AI yol haritası üretimi henüz desteklenmiyor. " +
            "Adımları elle ekleyebilirsiniz.",
        },
        { status: 400 },
      );
    }

    if (!assignedProject.studentProfile) {
      return NextResponse.json({ error: "Atamanın sahibi bulunamadı." }, { status: 400 });
    }

    if (!(await profilSahibininRizasiVar(assignedProject.studentProfile.id))) {
      return NextResponse.json(
        {
          error:
            "Bu öğrenci yapay zekâ işleme onayı vermediği için AI üretimi " +
            "kullanılamıyor. Öğrenci onayı profilinden verebilir.",
          rizaGerekli: true,
        },
        { status: 403 },
      );
    }

    // 3. Zaten bir yol haritası varsa: overwrite istenmemişse uyar; istenmişse
    //    yalnızca DRAFT ise sil (#178-4).
    if (assignedProject.roadmap) {
      if (parsed.data.overwrite) {
        // #178-4: PUBLISHED roadmap öğrenci erişimindedir — silme, adımlara bağlı
        // yorum/dosya/issue kayıtlarını cascade götürür (geri dönüşsüz veri kaybı).
        // Bu yüzden yalnızca henüz yayınlanmamış (DRAFT) roadmap silinebilir.
        if (assignedProject.roadmap.status !== "DRAFT") {
          return NextResponse.json(
            {
              error:
                "Yayınlanmış bir yol haritası yeniden üretilerek silinemez. Öğrencinin ilerlemesini korumak için bu işlem yalnızca taslak (DRAFT) yol haritalarında yapılabilir.",
            },
            { status: 409 }
          );
        }
        // Eski taslağı temizle, Posilog ile yeniden üret
        await prisma.roadmap.delete({
          where: { id: assignedProject.roadmap.id },
        });
      } else {
        return NextResponse.json(
          { error: "Bu proje için zaten bir yol haritası oluşturulmuş!" },
          { status: 400 }
        );
      }
    }

    // 4. Gemini AI'a verileri gönderip adımları (JSON dizisini) alıyoruz
    /*
     * #410: KAYITLI PROFİL ANALİZİ (#47) prompt'a giriyor.
     *
     * ⚠️ BU GİRDİ BUGÜNE KADAR HİÇ KULLANILMIYORDU. Platform her stajyer
     * için `strengths`, `developmentAreas`, `recommendedPath` üretip
     * saklıyordu ama yol haritası üretimi yalnız seviye + ilgi alanları +
     * hedefleri görüyordu.
     *
     * ⚠️ ANALİZ YOKSA ÇÖKMÜYOR. Henüz üretilmemiş olabilir ya da rıza geri
     * alınınca SİLİNMİŞ olabilir (#352); o durumda üretim eski davranışına
     * düşüyor.
     *
     * Rıza kapısı yukarıda (#321): buraya gelindiğinde öğrenci zaten AI
     * işlemesine rıza vermiş oluyor.
     */
    const analiz = await getStoredProfileAnalysis(assignedProject.studentProfile.id);

    /*
     * #423: ÖĞRENCİNİN GEÇMİŞ İŞİ.
     *
     * İkinci projesinde stajyer yine "Proje Kurulumu ve Gerekli Araçlar"
     * adımını alıyordu; tamamlanmış adımlar prompt'a hiç girmiyordu.
     * Sahiplik `sahiplik.ts`'ten soruluyor — takım atamasında
     * `studentProfileId` NULL (#332).
     */
    const gecmisAdimlar = await tamamlananAdimBasliklari({
      studentProfileId: assignedProject.studentProfile.id,
      haricAtamaId: assignedProject.id,
      azami: AZAMI_GECMIS_ADIM,
    });

    const roadmapStepsData = await generateRoadmap(
      assignedProject.studentProfile,
      assignedProject.projectTemplate,
      analiz
        ? {
            strengths: analiz.strengths,
            developmentAreas: analiz.developmentAreas,
            recommendedPath: analiz.recommendedPath,
          }
        : null,
      { yonlendirme: parsed.data.yonlendirme, gecmisAdimlar },
    );

    // 5. 🚀 Prisma Nested Create: Ana Roadmap'i ve ona bağlı tüm adımları tek bir işlemde veritabanına kaydediyoruz
    const newRoadmap = await prisma.roadmap.create({
      data: {
        assignedProjectId: assignedProject.id,
        title: `${assignedProject.projectTemplate.title} - Öğrenme Rotası`,
        status: "DRAFT", // Mentör onayına sunmak için önce taslak olarak kaydedilir
        steps: {
          create: roadmapStepsData.map((step) => ({
            order: step.order,
            title: step.title,
            description: step.description,
            estimatedHours: step.estimatedHours,
            resources: step.resources,
            status: "TODO"
          }))
        }
      },
      include: {
        steps: true // Frontend'e oluşturulan adımları da geri dönüyoruz
      }
    });

    return NextResponse.json({ roadmap: newRoadmap }, { status: 200 });

  } catch (error) {
    rotaHatasi("Yol haritası API Hatası:", error);
    return NextResponse.json(
      { error: "Yol haritası oluşturulurken bir hata meydana geldi." }, 
      { status: 500 }
    );
  }
}