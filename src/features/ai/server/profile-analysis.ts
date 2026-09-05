import { getModel } from "@/lib/ai/gemini-client";
import { cozVeDogrula } from "@/lib/ai/response";
import { VARSAYILAN_MODEL } from "@/lib/ai/model-adi";
import { uretimKokeni, type UretimKokeni } from "@/lib/ai/uretim-kokeni";
import { guvenliMetin, guvenliListe, veriBlogu } from "@/lib/ai/prompt";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { experienceLevelLabel } from "@/lib/experience-level";

export type ProfileAnalysisInput = {
  experienceLevel: string;
  interests: string[];
  goals?: string;
  availability?: string;
  /**
   * #289: Genişletilen başvuru soruları. Hepsi OPSİYONEL — eski profillerde
   * yoklar ve analiz onlarsız da çalışmaya devam etmeli.
   */
  gitLevel?: string;
  weeklyHours?: number;
  englishLevel?: string;
  school?: string;
  department?: string;
  classYear?: string;
  city?: string;
};

export type ProfileAnalysisResult = {
  level: 'Başlangıç' | 'Orta' | 'İleri';
  tracks: string[];           // teknik eğilimler / uygun alanlar
  summary: string;
  strengths: string[];        // #47: güçlü yönler
  developmentAreas: string[]; // #47: gelişim alanları
  recommendedPath: string;    // #47: önerilen yol
  recommendations: string[];
  /**
   * #494: Bu sonuç GERÇEK AI çıktısı mı, yedek (mock) mu?
   *
   * ⚠️ OPSİYONEL ve bilerek: eski çağrı yerleri ve testler nesneyi elle
   * kuruyor. Zorunlu yapmak onların hepsini kırardı ve alanın DEĞERİ
   * "kim üretti" bilgisini KAYDETMEKTE, tip zorlamasında değil.
   */
  koken?: UretimKokeni | null;
};

/**
 * #320: Model çıktısının ŞEKLİ doğrulanır.
 *
 * Öncesi `JSON.parse(text) as ProfileAnalysisResult` idi — yani hiç kontrol
 * yoktu. Model eksik/farklı bir nesne döndürdüğünde hata ancak DB'ye yazarken
 * ya da UI'da ortaya çıkıyor, arada mock'a düşülüyordu ve bu SESSİZDİ.
 */
const profilAnaliziSemasi = z.object({
  level: z.enum(["Başlangıç", "Orta", "İleri"]),
  tracks: z.array(z.string()).min(1),
  summary: z.string().min(1),
  strengths: z.array(z.string()),
  developmentAreas: z.array(z.string()),
  recommendedPath: z.string().min(1),
  recommendations: z.array(z.string()),
});

/** Ham değerleri isteme okunur biçimde koyar; model kod değeri görmesin. */
const GIT_ETIKET: Record<string, string> = {
  none: 'Hiç kullanmamış',
  basic: 'commit/push yapabiliyor',
  branching: 'branch açıp merge edebiliyor',
  pr: 'PR açmış, review almış',
};
const INGILIZCE_ETIKET: Record<string, string> = {
  none: 'Yok denecek kadar az',
  reading: 'Dokümantasyon okuyabiliyor',
  conversational: 'Konuşma seviyesinde',
  fluent: 'Akıcı',
};
const gitEtiketi = (v?: string) => (v && GIT_ETIKET[v]) || 'Belirtilmemiş';
const ingilizceEtiketi = (v?: string) => (v && INGILIZCE_ETIKET[v]) || 'Belirtilmemiş';

export async function analyzeStudentProfile(
  input: ProfileAnalysisInput
): Promise<ProfileAnalysisResult> {

  const prompt = `Sen bir yazılım eğitimi uzmanısın. Aşağıdaki stajyer/öğrenci profilini analiz et ve değerlendir:

Deneyim Seviyesi: ${experienceLevelLabel(input.experienceLevel)}
${veriBlogu('İlgi Alanları', guvenliListe(input.interests))}
${veriBlogu('Hedefler', guvenliMetin(input.goals))}
${veriBlogu('Çalışma Uygunluğu', guvenliMetin(input.availability))}
Haftalık Ayrılabilen Saat: ${input.weeklyHours ? input.weeklyHours + ' saat' : 'Belirtilmemiş'}
Git/GitHub Deneyimi: ${gitEtiketi(input.gitLevel)}
İngilizce: ${ingilizceEtiketi(input.englishLevel)}
Eğitim: ${[input.school, input.department, input.classYear].filter(Boolean).join(' · ') || 'Belirtilmemiş'}

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
5b. Git/GitHub deneyimi zayıfsa (hiç kullanmamış veya yalnızca commit/push) ilk
    adımlar bunu ÖĞRETECEK şekilde planlansın — platformun tüm iş akışı repo,
    issue ve PR üzerinden yürüyor
5c. Haftalık saat belirtilmişse öneriler o bütçeye SIĞSIN
6. "recommendations" pratik ve uygulanabilir olsun
7. Sadece JSON döndür, başka metin ekleme`;

  try {
    const model = getModel();

    const request = {
      contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    };

    const result = await model.generateContent(request);
    // #320/#335: Metin çıkarımı, JSON ayıklama ve ŞEKİL doğrulaması tek yerde.
    //
    // Öncesi burada ~20 satırlık elle ayrıştırma vardı: kod bloğu temizleme,
    // sınır bulma, `as` ile tip varsayımı ve eksik alanlara savunmacı
    // varsayılan atama. Zod şeması şekli garanti ettiği için o varsayılanlar
    // gereksiz; şema tutmazsa catch bloğu mock'a düşürüyor VE bu artık
    // sayaç + uyarı logu ile görünür oluyor.
    return {
      ...cozVeDogrula(result, profilAnaliziSemasi, "profile-analysis"),
      koken: uretimKokeni(VARSAYILAN_MODEL),
    };

  } catch (error) {
    logger.error('Profil analizi hatası', error);

    /*
     * ⚠️ YEDEK ÇIKTIDA KÖKEN `null` — "gerçek AI" diye kaydedilmemeli.
     *
     * #377 kullanıcının mock'u gerçek çıktıdan ayırt EDEMEDİĞİNİ
     * belgelemişti; burada aynı çıktı VERİTABANINA kalıcı yazılıyor.
     * Prompt sürümü yazsaydık kayıt, hiç kurulmamış bir AI çağrısını
     * olmuş gibi gösterirdi.
     */
    return {
      koken: null,
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
