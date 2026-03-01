import { getModel } from "@/lib/ai/gemini-client";
import { StudentProfile, ProjectTemplate } from "@prisma/client";

export interface RankedProject {
  projectId: string;
  matchScore: number;
  reason: string;
}

export async function recommendProjects(
  studentProfile: StudentProfile,
  availableProjects: ProjectTemplate[]
): Promise<RankedProject[]> {
  try {
    const model = getModel();

    const interestsText = Array.isArray(studentProfile.interests)
      ? studentProfile.interests.join(", ")
      : String(studentProfile.interests);

    const prompt = `
      Sen kıdemli bir yazılım mentörüsün. Görevin, bir öğrencinin profiline en uygun projeleri seçmektir.

      ÖĞRENCİ PROFİLİ:
      - Seviye: ${studentProfile.experienceLevel}
      - İlgi Alanları: ${interestsText}
      - Hedefler: ${studentProfile.goals}

      MEVCUT PROJE ŞABLONLARI:
      ${JSON.stringify(availableProjects.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        track: p.track,
        difficulty: p.difficulty
      })), null, 2)}

      GÖREV:
      Yukarıdaki projelere bakarak, bu öğrenci için en uygun 3 projeyi seç ve uyumluluklarına göre sırala.
      Yanıtın ŞU FORMATTA BİR JSON DİZİSİ olmalıdır: [{"projectId": "projenin_gercek_idsi", "matchScore": 95, "reason": "kısa açıklama"}]
    `;

    const request = {
      contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    };

    const result = await model.generateContent(request);
    let text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("Proje Önerisi Yanıtı:", text);

    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');

    if (startIndex !== -1 && endIndex !== -1) {
      text = text.substring(startIndex, endIndex + 1);
    }

    const recommendations: RankedProject[] = JSON.parse(text);
    return recommendations;

  } catch (error) {
    console.error("Proje önerisi hatası:", error);
    throw new Error("Projeler analiz edilemedi. Lütfen daha sonra tekrar deneyin.");
  }
}
