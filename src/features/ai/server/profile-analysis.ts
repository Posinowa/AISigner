import { getModel } from "@/lib/ai/gemini-client";
import { logger } from "@/lib/logger";
import { experienceLevelLabel } from "@/lib/experience-level";

export type ProfileAnalysisInput = {
  experienceLevel: string;
  interests: string[];
  goals?: string;
  availability?: string;
};

export type ProfileAnalysisResult = {
  level: 'Başlangıç' | 'Orta' | 'İleri';
  tracks: string[];           // teknik eğilimler / uygun alanlar
  summary: string;
  strengths: string[];        // #47: güçlü yönler
  developmentAreas: string[]; // #47: gelişim alanları
  recommendedPath: string;    // #47: önerilen yol
  recommendations: string[];
};

export async function analyzeStudentProfile(
  input: ProfileAnalysisInput
): Promise<ProfileAnalysisResult> {

  const prompt = `Sen bir yazılım eğitimi uzmanısın. Aşağıdaki stajyer/öğrenci profilini analiz et ve değerlendir:

Deneyim Seviyesi: ${experienceLevelLabel(input.experienceLevel)}
İlgi Alanları: ${input.interests.join(', ')}
Hedefler: ${input.goals || 'Belirtilmemiş'}
Çalışma Uygunluğu: ${input.availability || 'Belirtilmemiş'}

Lütfen aşağıdaki formatta SADECE JSON yanıtı ver (başka metin ekleme):
{
  "level": "Başlangıç" veya "Orta" veya "İleri" (bunlardan biri olmalı),
  "tracks": ["Frontend Development", "Backend", vb. - öğrenciye uygun 2-4 teknoloji alanı (teknik eğilimler)],
  "summary": "2-3 cümlelik profesyonel değerlendirme (Türkçe, pozitif ve motive edici)",
  "strengths": ["öğrencinin 2-4 güçlü yönü (Türkçe)"],
  "developmentAreas": ["gelişime açık 2-4 alan (Türkçe, yapıcı)"],
  "recommendedPath": "öğrenciye önerilen öğrenme/gelişim yolu (2-3 cümle, Türkçe)",
  "recommendations": ["öğrenciye özel 3-4 pratik tavsiye (Türkçe)"]
}

ÖNEMLİ KURALLAR:
1. "level" sadece şu 3 değerden biri olabilir: "Başlangıç", "Orta", "İleri"
2. "tracks" dizisinde 2-4 alan öner
3. "summary" pozitif ve motive edici olsun
4. "strengths" ve "developmentAreas" dizilerinde 2-4 madde olsun; developmentAreas yapıcı bir dille yazılsın
5. "recommendedPath" somut ve uygulanabilir bir yol tarifi olsun
6. "recommendations" pratik ve uygulanabilir olsun
7. Sadece JSON döndür, başka metin ekleme`;

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

    // #47: Yeni alanlar model tarafından üretilmemişse güvenli varsayılanlar ata
    // (şekil her zaman tam olsun; downstream persist/gösterim bozulmasın).
    parsedResult.tracks = Array.isArray(parsedResult.tracks) ? parsedResult.tracks : [];
    parsedResult.strengths = Array.isArray(parsedResult.strengths) ? parsedResult.strengths : [];
    parsedResult.developmentAreas = Array.isArray(parsedResult.developmentAreas) ? parsedResult.developmentAreas : [];
    parsedResult.recommendedPath = typeof parsedResult.recommendedPath === 'string' ? parsedResult.recommendedPath : '';
    parsedResult.recommendations = Array.isArray(parsedResult.recommendations) ? parsedResult.recommendations : [];

    return parsedResult;

  } catch (error) {
    logger.error('Profil analizi hatası', error);

    return {
      level: 'Orta',
      tracks: input.interests.slice(0, 3),
      summary: `${experienceLevelLabel(input.experienceLevel)} seviyesinde bir öğrenci. ${input.interests.join(', ')} alanlarında ilgi gösteriyor.`,
      strengths: [
        'Öğrenmeye açık ve istekli',
        `${input.interests[0] ?? 'Yazılım'} alanına ilgi duyuyor`,
      ],
      developmentAreas: [
        'Temel kavramların pekiştirilmesi',
        'Proje deneyiminin artırılması',
      ],
      recommendedPath:
        'Önce temel kavramları pekiştir, ardından küçük projelerle pratik yaparak ilerle. Düzenli olarak kaynakları takip et.',
      recommendations: [
        'Temel kavramları pekiştirmeye devam edin',
        'Küçük projelerle pratik yapın',
        'Açık kaynak projelere katkıda bulunmayı deneyin',
        'Online kurslar ve dökümanları takip edin',
      ],
    };
  }
}
