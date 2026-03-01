import { NextResponse } from "next/server";
import { prisma } from "@/lib/db"; // Projendeki prisma bağlantı dosyası (önceki düzeltmemiz)
import { generateRoadmap } from "@/features/ai/server/generate-roadmap";

export async function POST(req: Request) {
  try {
    // 1. Frontend'den gelen isteği alıyoruz
    const body = await req.json();
    const { assignedProjectId } = body;

    if (!assignedProjectId) {
      return NextResponse.json(
        { error: "Atanmış Proje ID'si gerekli!" }, 
        { status: 400 }
      );
    }

    // 2. Veritabanından atanmış projeyi ve ona bağlı öğrenci ile şablonu çekiyoruz
    const assignedProject = await prisma.assignedProject.findUnique({
      where: { id: assignedProjectId },
      include: {
        studentProfile: true,
        projectTemplate: true,
        roadmap: true // Zaten bir yol haritası var mı diye kontrol etmek için
      }
    });

    if (!assignedProject) {
      return NextResponse.json({ error: "Atanmış proje bulunamadı!" }, { status: 404 });
    }

    // 3. İki kere aynı projeye yol haritası oluşturulmasını engelliyoruz
    if (assignedProject.roadmap) {
      return NextResponse.json(
        { error: "Bu proje için zaten bir yol haritası oluşturulmuş!" }, 
        { status: 400 }
      );
    }

    // 4. Gemini AI'a verileri gönderip adımları (JSON dizisini) alıyoruz
    const roadmapStepsData = await generateRoadmap(
      assignedProject.studentProfile,
      assignedProject.projectTemplate
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

  } catch (error: any) {
    console.error("Yol haritası API Hatası:", error);
    return NextResponse.json(
      { error: error.message || "Yol haritası oluşturulurken bir hata meydana geldi." }, 
      { status: 500 }
    );
  }
}