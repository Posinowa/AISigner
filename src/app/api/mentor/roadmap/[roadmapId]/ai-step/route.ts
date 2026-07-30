import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getModel } from "@/lib/ai/gemini-client";
import { requireAuth } from "@/lib/auth/guard";
import { experienceLevelLabel } from "@/lib/experience-level";

export async function POST(
  req: Request,
  context: { params: Promise<{ roadmapId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const { roadmapId } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const customPrompt = body.prompt ? String(body.prompt).trim() : null;

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        steps: { orderBy: { order: "asc" } },
        assignedProject: {
          include: {
            studentProfile: {
              include: { user: true },
            },
            projectTemplate: true,
          },
        },
      },
    });

    if (!roadmap) {
      return NextResponse.json({ error: "Yol haritası bulunamadı" }, { status: 404 });
    }

    if (roadmap.assignedProject.studentProfile.mentorId !== auth.session.user.id) {
      return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 403 });
    }

    const studentProfile = roadmap.assignedProject.studentProfile;
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
      const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.title && parsed.description) {
          aiStepData = {
            title: parsed.title,
            description: parsed.description,
            estimatedHours: Number(parsed.estimatedHours) || 3,
            resources: Array.isArray(parsed.resources) ? parsed.resources : ["https://developer.mozilla.org"],
          };
        }
      }
    } catch (aiErr) {
      console.warn("Posilog AI step generation failed, using fallback:", aiErr);
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
