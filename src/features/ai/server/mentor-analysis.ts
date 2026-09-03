import { getModel } from "@/lib/ai/gemini-client";
import { guvenliMetin, guvenliListe, veriBlogu } from "@/lib/ai/prompt";
import { logger } from "@/lib/logger";
import { ilgiEtiketi, MENTOR_KIDEMLERI } from "@/features/student/models/secenekler";

/**
 * #288: Mentör profilinin AI değerlendirmesi.
 *
 * `analyzeStudentProfile` ile aynı desen (JSON çıktı, doğrulama, yedek), ama
 * sorular farklı: stajyerde "ne öğrenmeli", burada "KİME, NEYİ öğretebilir".
 *
 * Sözleşme: bu fonksiyon HATA FIRLATMAZ. Model yanıt vermezse veya bozuk JSON
 * dönerse başvurunun kendisinden türetilmiş bir yedek döner — mentör başvurusu
 * AI yüzünden kaybolmamalı.
 */

export type MentorAnalysisInput = {
  title: string;
  company?: string | null;
  yearsExperience: number;
  seniority: string;
  expertise: string[];
  capacity: number;
  weeklyHours: number;
  motivation: string;
  mentoringStyle: string;
  city?: string | null;
};

export type MentorAnalysisResult = {
  /** Stajyer analiziyle AYNI sözlük — admin iki tarafı yan yana okuyabilsin. */
  level: "Başlangıç" | "Orta" | "İleri";
  summary: string;
  strengths: string[];
  technicalTracks: string[];
  idealStudentProfile: string;
  matchingNotes: string[];
};

const GECERLI_SEVIYELER: MentorAnalysisResult["level"][] = ["Başlangıç", "Orta", "İleri"];

const kidemEtiketi = (deger: string) =>
  MENTOR_KIDEMLERI.find((k) => k.deger === deger)?.etiket ?? deger;

/**
 * Model yanıt veremediğinde başvurunun KENDİSİNDEN türetilen değerlendirme.
 * Uydurma değil, beyan edilen veriyi özetliyor; admin yine de bir şey okuyor.
 */
export function mentorYedekAnalizi(girdi: MentorAnalysisInput): MentorAnalysisResult {
  const alanlar = girdi.expertise.map(ilgiEtiketi);
  const seviye: MentorAnalysisResult["level"] =
    girdi.yearsExperience >= 6 ? "İleri" : girdi.yearsExperience >= 3 ? "Orta" : "Başlangıç";

  return {
    level: seviye,
    summary: `${girdi.title}${girdi.company ? ` (${girdi.company})` : ""}, ${girdi.yearsExperience} yıllık deneyimle ${alanlar.join(", ") || "belirtilmemiş alanlarda"} mentörlük yapmak istiyor. Haftada ${girdi.weeklyHours} saat ve aynı anda ${girdi.capacity} stajyer kapasitesi beyan etti.`,
    strengths: [
      `${kidemEtiketi(girdi.seniority)} seviyesinde profesyonel deneyim`,
      ...(alanlar.length ? [`${alanlar[0]} alanında uzmanlık`] : []),
    ],
    technicalTracks: alanlar.slice(0, 4),
    idealStudentProfile:
      alanlar.length > 0
        ? `${alanlar.join(" veya ")} alanlarına ilgi duyan stajyerler.`
        : "Uzmanlık alanı belirtilmediği için eşleştirme önerisi üretilemedi.",
    matchingNotes: [
      `Haftalık ${girdi.weeklyHours} saat — stajyerin temposuyla uyumu kontrol edilmeli`,
      `Aynı anda en fazla ${girdi.capacity} stajyer`,
    ],
  };
}

export async function analyzeMentorProfile(
  input: MentorAnalysisInput,
): Promise<MentorAnalysisResult> {
  const alanlar = input.expertise.map(ilgiEtiketi).join(", ") || "Belirtilmemiş";

  const prompt = `Sen mentör-stajyer eşleştirmesi yapan bir uzmansın. Aşağıdaki MENTÖR başvurusunu değerlendir:

${veriBlogu("Ünvan", guvenliMetin(input.title, 200))}
Toplam Deneyim: ${input.yearsExperience} yıl
Kıdem: ${kidemEtiketi(input.seniority)}
Öğretebileceği Alanlar: ${alanlar}
Kapasite: aynı anda ${input.capacity} stajyer
Haftalık Ayırabildiği Süre: ${input.weeklyHours} saat
${veriBlogu("Şehir", guvenliMetin(input.city, 100))}

${veriBlogu("Mentörlük motivasyonu", guvenliMetin(input.motivation))}

${veriBlogu("Mentörlük tarzı", guvenliMetin(input.mentoringStyle))}

Lütfen aşağıdaki formatta SADECE JSON yanıtı ver (başka metin ekleme):
{
  "level": "Başlangıç" veya "Orta" veya "İleri" (mentörün ÖĞRETME kapasitesi),
  "summary": "2-3 cümlelik değerlendirme (Türkçe, objektif)",
  "strengths": ["mentörün 2-4 güçlü yönü (Türkçe)"],
  "technicalTracks": ["öğretmeye en uygun 2-4 teknik alan"],
  "idealStudentProfile": "hangi stajyer profiline uygun olduğu (2-3 cümle, Türkçe)",
  "matchingNotes": ["admin için 2-4 somut eşleştirme ipucu (Türkçe)"]
}

ÖNEMLİ KURALLAR:
1. "level" sadece şu 3 değerden biri olabilir: "Başlangıç", "Orta", "İleri"
2. Değerlendirme mentörün KENDİ öğrenmesi değil, ÖĞRETME kapasitesi üzerine olsun
3. "mentörlük tarzı" metni en ayırt edici girdi — idealStudentProfile'ı buradan türet
4. Haftalık süre düşükse (5 saatin altı) bunu matchingNotes'ta uyarı olarak belirt
5. Abartma; beyan edilenin ötesinde yetenek atfetme
6. Sadece JSON döndür, başka metin ekleme`;

  try {
    const model = getModel();
    const result = await model.generateContent({
      contents: [{ role: "user" as const, parts: [{ text: prompt }] }],
    });

    let text = result.text;
    logger.debug("Mentör analizi ham yanıtı", text);

    // Yük taşıyan temizlik AŞAĞIDAKİ parantez arası kesme; fence soymayı
    // kaldırmak hiçbir testi kırmıyor (ölçüldü) çünkü kesme fence`li yanıtı
    // da doğru ayıklıyor. Yine de duruyor: `profile-analysis.ts` ile simetri
    // ve modelin fence dışında da süslü parantez basma ihtimaline karşı.
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const bas = text.indexOf("{");
    const son = text.lastIndexOf("}");
    if (bas !== -1 && son !== -1) text = text.substring(bas, son + 1);

    const cozulen = JSON.parse(text) as MentorAnalysisResult;

    if (!cozulen.level || !cozulen.summary) {
      throw new Error("Gemini yanıtında gerekli alanlar eksik");
    }

    // Şekil her zaman TAM olsun; eksik alan downstream persist/gösterimi bozardı.
    const yedek = mentorYedekAnalizi(input);
    return {
      level: GECERLI_SEVIYELER.includes(cozulen.level) ? cozulen.level : yedek.level,
      summary: cozulen.summary,
      strengths: Array.isArray(cozulen.strengths) ? cozulen.strengths : yedek.strengths,
      technicalTracks: Array.isArray(cozulen.technicalTracks)
        ? cozulen.technicalTracks
        : yedek.technicalTracks,
      idealStudentProfile:
        typeof cozulen.idealStudentProfile === "string" && cozulen.idealStudentProfile
          ? cozulen.idealStudentProfile
          : yedek.idealStudentProfile,
      matchingNotes: Array.isArray(cozulen.matchingNotes)
        ? cozulen.matchingNotes
        : yedek.matchingNotes,
    };
  } catch (error) {
    logger.error("Mentör analizi hatası", error);
    return mentorYedekAnalizi(input);
  }
}
