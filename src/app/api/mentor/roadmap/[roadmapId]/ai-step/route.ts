import { NextResponse } from "next/server";
import { profilSahibininRizasiVar } from "@/features/kvkk/riza";
import { prisma } from "@/lib/db";
import {
  ATAMA_SAHIPLIK_SELECT,
  mentoruMu,
} from "@/features/teams/server/sahiplik";
import { z } from "zod";
import { getModel } from "@/lib/ai/gemini-client";
import { cozVeDogrula } from "@/lib/ai/response";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/guard";
import { experienceLevelLabel } from "@/lib/experience-level";

/**
 * #377: Model çıktısının ŞEKLİ doğrulanıyor.
 *
 * Öncesinde elle `parsed.title && parsed.description` kontrolü vardı; tip
 * yalnızca varsayılıyordu. `estimatedHours` ve `resources` opsiyonel çünkü
 * model bunları atlayabiliyor — o durumda fallback değerler kullanılıyor.
 */
const adimSemasi = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  estimatedHours: z.coerce.number().int().positive().optional(),
  resources: z.array(z.string()).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ roadmapId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const { roadmapId } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    // #191: Mentör serbest istem girer; sınırsız/serbest metin prompt'a gömülmesin.
    // - Uzunluk tavanı: kötüye kullanım ve gereksiz token maliyetini engeller.
    // - Çift tırnaklar temizlenir: girdi `"..."` delimiter'ı içine konduğu için
    //   bütünlüğü korunur (istem sınırından kaçış zorlaşır).
    const MAX_PROMPT_LEN = 500;
    const rawPrompt = body.prompt ? String(body.prompt).trim() : "";
    const customPrompt = rawPrompt
      ? rawPrompt.replace(/["\r\n]+/g, " ").slice(0, MAX_PROMPT_LEN)
      : null;

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        steps: { orderBy: { order: "asc" } },
        // #332: Sahiplik bireysel VEYA takım; yetki tek tanımdan gelir.
        // Prompt'ta öğrenci adı/seviyesi kullanıldığı için profil tümüyle
        // çekiliyor (takım dalı yukarıda erken dönüyor).
        assignedProject: {
          select: {
            ...ATAMA_SAHIPLIK_SELECT,
            studentProfile: { include: { user: true, mentorAssignments: { select: { mentorId: true } } } },
            projectTemplate: true,
          },
        },
      },
    });

    if (!roadmap) {
      return NextResponse.json({ error: "Yol haritası bulunamadı" }, { status: 404 });
    }

    // #195: öğrencinin mentorlarından biri mi?
    if (!mentoruMu(roadmap.assignedProject, auth.session.user.id)) {
      return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 403 });
    }

    // #332: Takım panosunda AI adım önerisi bu fazda yok (bkz.
    // generate-roadmap'teki aynı gerekçe).
    if (roadmap.assignedProject.team) {
      return NextResponse.json(
        { error: "Takım projeleri için AI adım önerisi henüz desteklenmiyor." },
        { status: 400 },
      );
    }

    const studentProfile = roadmap.assignedProject.studentProfile;
    if (!studentProfile) {
      return NextResponse.json({ error: "Atamanın sahibi bulunamadı." }, { status: 400 });
    }
    /*
     * ⚠️ #389: KVKK açık rızası — kardeş uç `generate-roadmap` bunu yapıyordu,
     * burası ATLAMIŞTI.
     *
     * Prompt öğrencinin ADINI, deneyim seviyesini ve proje bağlamını taşıyor;
     * işlemi mentör başlatsa da veri ÖĞRENCİYE ait, rıza da öğrencinin.
     *
     * Burada fallback'e düşmüyoruz, AÇIK HATA dönüyoruz: mentör bir adım
     * üretmeyi bilerek istedi, sessizce jenerik bir adım almamalı.
     */
    if (!(await profilSahibininRizasiVar(studentProfile.id))) {
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

    const projectTemplate = roadmap.assignedProject.projectTemplate;
    const existingStepTitles = roadmap.steps.map((s) => s.title).join(", ");
    const nextOrder = (roadmap.steps[roadmap.steps.length - 1]?.order ?? 0) + 1;

    let aiStepData = {
      title: "Gelişmiş Özellikler ve Modül İyileştirmesi",
      description: "Projeye modüler mimari ve gelişmiş hata yönetimi mekanizmalarının eklenmesi.",
      estimatedHours: 4,
      resources: ["https://developer.mozilla.org"],
    };

    try {
      const model = getModel();
      const promptText = `
Sen Posilog — AI Mentör asistanısın.
Öğrenci: ${studentProfile.user.name || "Öğrenci"} (Seviye: ${experienceLevelLabel(studentProfile.experienceLevel)})
Proje: ${projectTemplate.title} (${projectTemplate.description})
Mevcut Fazlar/Adımlar: ${existingStepTitles || "Henüz adım yok"}

${customPrompt ? `Mentörün Özel İsteği: "${customPrompt}"` : "GÖREV: Bu yol haritasına eklenecek sıradaki bir sonraki mantıklı ana fazı üret."}

JSON Formatı (Sadece geçerli bir JSON objesi döndür, başka hiçbir metin ekleme):
{
  "title": "Adım Başlığı",
  "description": "Adımın detaylı açıklaması ve hedefleri",
  "estimatedHours": 3,
  "resources": ["https://link-or-doc.com"]
}
`;

      const response = await model.generateContent(promptText);

      /*
       * #377: Elle regex temizliği KALDIRILDI.
       *
       * Burada ```json işaretleri elle siliniyor, `cozVeDogrula` içinde de
       * aynı iş yapılıyordu — iki ayrı "JSON'ı temizle" mantığı, biri
       * güncellenip diğeri unutulunca ayrışır. Üstelik buradaki sürüm daha
       * zayıftı: modelin JSON'un başına/sonuna eklediği açıklama metnini
       * ayıklamıyordu, o durumda `JSON.parse` patlayıp akış SESSİZCE
       * fallback'e düşüyordu.
       */
      const parsed = cozVeDogrula(response, adimSemasi, "ai-step");
      aiStepData = {
        title: parsed.title,
        description: parsed.description,
        estimatedHours: parsed.estimatedHours ?? 3,
        resources:
          parsed.resources && parsed.resources.length > 0
            ? parsed.resources
            : ["https://developer.mozilla.org"],
      };
    } catch (aiErr) {
      // ⚠️ Düşüş SESSİZ DEĞİL: `cozVeDogrula` sayacı artırıyor (#335) ve
      // burada da loglanıyor. Mentör fallback bir adım aldığında bunun
      // izlenebilir olması gerekiyor.
      logger.warn("Posilog adım üretimi başarısız, fallback kullanılıyor", {
        roadmapId,
        error: aiErr instanceof Error ? aiErr.message : String(aiErr),
      });
    }

    const newStep = await prisma.roadmapStep.create({
      data: {
        roadmapId,
        order: nextOrder,
        title: aiStepData.title,
        description: aiStepData.description,
        estimatedHours: aiStepData.estimatedHours,
        resources: aiStepData.resources,
        status: "TODO",
      },
    });

    return NextResponse.json({ step: newStep, message: "Posilog tarafından yeni adım başarıyla üretildi!" });
  } catch (error) {
    console.error("POST /api/mentor/roadmap/[roadmapId]/ai-step error:", error);
    return NextResponse.json({ error: "AI adımı üretilirken bir hata oluştu" }, { status: 500 });
  }
}
