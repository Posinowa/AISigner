import { getModel } from "@/lib/ai/gemini-client";
import { cozVeDogrula } from "@/lib/ai/response";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { experienceLevelLabel } from "@/lib/experience-level";
import { StudentProfile, ProjectTemplate } from "@prisma/client";

/** #320: Model çıktısının şekli doğrulanır (öncesi `as` ile varsayılıyordu). */
const roadmapSemasi = z.array(
  z.object({
    order: z.number(),
    title: z.string().min(1),
    description: z.string(),
    estimatedHours: z.number(),
    resources: z.array(z.string()),
  }),
).min(1);

export interface RoadmapStepData {
  order: number;
  title: string;
  description: string;
  estimatedHours: number;
  resources: string[];
}

export async function generateRoadmap(
  studentProfile: StudentProfile,
  projectTemplate: ProjectTemplate
): Promise<RoadmapStepData[]> {
  try {
    const model = getModel();

    const interestsText = Array.isArray(studentProfile.interests)
      ? studentProfile.interests.join(", ")
      : String(studentProfile.interests);

    const prompt = `
      Sen kıdemli bir teknik eğitmen ve yazılım mimarısın.
      Aşağıda profili verilen öğrenciye, belirtilen projeyi sıfırdan tamamlayabilmesi için
      adım adım bir öğrenme ve geliştirme yol haritası (roadmap) çıkarman gerekiyor.

      ÖĞRENCİ PROFİLİ:
      - Seviye: ${experienceLevelLabel(studentProfile.experienceLevel)}
      - İlgi Alanları: ${interestsText}
      - Hedefler: ${studentProfile.goals || "Belirtilmemiş"}

      PROJE BİLGİLERİ:
      - Proje Adı: ${projectTemplate.title}
      - Açıklama: ${projectTemplate.description}
      - Teknolojiler (Track): ${projectTemplate.track.join(", ")}
      - Zorluk: ${projectTemplate.difficulty}

      GÖREV:
      Bu projeyi başarıyla bitirebilmesi için öğrenciye 4 ila 7 adım (step) arasında, mantıklı bir sıralamaya sahip bir yol haritası oluştur.
      Her adımın bir başlığı, ne yapılması gerektiğini anlatan bir açıklaması, tahmini süresi (saat cinsinden) ve araştırması için 1-2 adet kaynak linki veya arama terimi olmalı.

      YANIT FORMATI:
      SADECE AŞAĞIDAKİ GİBİ BİR JSON DİZİSİ (ARRAY) DÖNDÜR. Başka hiçbir markdown veya metin ekleme.
      [
        {
          "order": 1,
          "title": "Proje Kurulumu ve Gerekli Araçlar",
          "description": "Node.js ve React kurulumlarını yapın.",
          "estimatedHours": 2,
          "resources": ["https://react.dev/learn"]
        }
      ]
    `;

    const request = {
      contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    };

    const result = await model.generateContent(request);
    const roadmapSteps = cozVeDogrula(result, roadmapSemasi, "generate-roadmap");

    return roadmapSteps.sort((a, b) => a.order - b.order);

  } catch (error) {
    logger.error("Roadmap oluşturulurken hata", error);
    throw new Error("Yol haritası üretilemedi. Lütfen daha sonra tekrar deneyin.");
  }
}
