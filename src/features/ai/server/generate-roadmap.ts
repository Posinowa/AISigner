import { getModel } from "@/lib/ai/gemini-client";
import { logger } from "@/lib/logger";
import { StudentProfile, ProjectTemplate } from "@prisma/client";

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
      - Seviye: ${studentProfile.experienceLevel}
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
    let text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    logger.debug("Roadmap ham yanıtı", text);

    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');

    if (startIndex !== -1 && endIndex !== -1) {
      text = text.substring(startIndex, endIndex + 1);
    }

    const roadmapSteps: RoadmapStepData[] = JSON.parse(text);

    return roadmapSteps.sort((a, b) => a.order - b.order);

  } catch (error) {
    logger.error("Roadmap oluşturulurken hata", error);
    throw new Error("Yol haritası üretilemedi. Lütfen daha sonra tekrar deneyin.");
  }
}
