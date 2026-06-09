import { getModel } from "@/lib/ai/gemini-client";
import { logger } from "@/lib/logger";

export type ProfileAnalysisInput = {
  experienceLevel: string;
  interests: string[];
  goals?: string;
  availability?: string;
};

export type ProfileAnalysisResult = {
  level: 'Başlangıç' | 'Orta' | 'İleri';
  tracks: string[];
  summary: string;
  recommendations: string[];
};

export async function analyzeStudentProfile(
  input: ProfileAnalysisInput
): Promise<ProfileAnalysisResult> {

  const prompt = `Sen bir yazılım eğitimi uzmanısın. Aşağıdaki stajyer/öğrenci profilini analiz et ve değerlendir:

Deneyim Seviyesi: ${input.experienceLevel}
İlgi Alanları: ${input.interests.join(', ')}
Hedefler: ${input.goals || 'Belirtilmemiş'}
Çalışma Uygunluğu: ${input.availability || 'Belirtilmemiş'}

Lütfen aşağıdaki formatta SADECE JSON yanıtı ver (başka metin ekleme):
{
  "level": "Başlangıç" veya "Orta" veya "İleri" (bunlardan biri olmalı),
  "tracks": ["Frontend Development", "Backend", vb. - öğrenciye uygun 2-4 teknoloji alanı],
  "summary": "2-3 cümlelik profesyonel değerlendirme (Türkçe, pozitif ve motive edici)",
  "recommendations": ["öğrenciye özel 3-4 pratik tavsiye (Türkçe)"]
}

ÖNEMLİ KURALLAR:
1. "level" sadece şu 3 değerden biri olabilir: "Başlangıç", "Orta", "İleri"
2. "tracks" dizisinde 2-4 alan öner
3. "summary" pozitif ve motive edici olsun
4. "recommendations" pratik ve uygulanabilir olsun
5. Sadece JSON döndür, başka metin ekleme`;

  try {
    const model = getModel();

    const request = {
      contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    };

    const result = await model.generateContent(request);
    let text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    logger.debug("Profil analizi ham yanıtı", text);

    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');

    if (startIndex !== -1 && endIndex !== -1) {
      text = text.substring(startIndex, endIndex + 1);
    }

    const parsedResult = JSON.parse(text) as ProfileAnalysisResult;

    if (!parsedResult.level || !parsedResult.tracks || !parsedResult.summary) {
      throw new Error('Gemini yanıtında gerekli alanlar eksik');
    }

    const validLevels: Array<'Başlangıç' | 'Orta' | 'İleri'> = ['Başlangıç', 'Orta', 'İleri'];
    if (!validLevels.includes(parsedResult.level)) {
      logger.warn(`Geçersiz level: ${parsedResult.level}, Orta olarak ayarlandı`);
      parsedResult.level = 'Orta';
    }

    return parsedResult;

  } catch (error) {
    logger.error('Profil analizi hatası', error);

    return {
      level: 'Orta',
      tracks: input.interests.slice(0, 3),
      summary: `${input.experienceLevel} seviyesinde bir öğrenci. ${input.interests.join(', ')} alanlarında ilgi gösteriyor.`,
      recommendations: [
        'Temel kavramları pekiştirmeye devam edin',
        'Küçük projelerle pratik yapın',
        'Açık kaynak projelere katkıda bulunmayı deneyin',
        'Online kurslar ve dökümanları takip edin',
      ],
    };
  }
}
