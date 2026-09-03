import { getModel } from "@/lib/ai/gemini-client";
import { guvenliMetin, guvenliListe, veriBlogu } from "@/lib/ai/prompt";
import { cozVeDogrula } from "@/lib/ai/response";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { experienceLevelLabel } from "@/lib/experience-level";
import { StudentProfile, ProjectTemplate } from "@prisma/client";

/** Prompt'un istediği adım aralığı — şema da AYNI sayıları kullanıyor. */
export const EN_AZ_ADIM = 4;
export const EN_COK_ADIM = 7;

/** Bir adım için makul süre sınırları (saat). */
const EN_AZ_SAAT = 1;
const EN_COK_SAAT = 60;

/**
 * Model çıktısının şekli VE MAKULLÜĞÜ doğrulanır (#320/#410).
 *
 * ⚠️ ÖNCESİ SAYILARI HİÇ SINIRLAMIYORDU: `estimatedHours: z.number()`
 * negatif, 0 ya da 500 kabul ediyordu; dizi `.min(1)` idi, yani prompt 4–7
 * adım isterken şema TEK adımlı bir yol haritasını sessizce geçiriyordu.
 * "Üretildi" deyip tek satır vermek, mock'a düşmekten daha sinsi
 * (#377'deki `issue-generator` kararının aynısı).
 *
 * ⚠️ `resources` artık ARAMA TERİMİ kabul ediyor, URL değil. Model var
 * olmayan bağlantılar üretebiliyordu ve uydurma bir kaynak linki, hiç link
 * olmamasından kötü: stajyer tıklıyor, 404 alıyor, güveni sarsılıyor.
 * Arama terimi uydurulamaz. Prompt da bunu istiyor; şema URL gelirse
 * REDDETMİYOR — geçerli bir belge bağlantısı değerli — ama uzunluk
 * sınırları saçma girdileri eliyor.
 */
const roadmapSemasi = z
  .array(
    z.object({
      order: z.number().int().positive(),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      estimatedHours: z.number().int().min(EN_AZ_SAAT).max(EN_COK_SAAT),
      resources: z.array(z.string().min(1).max(300)).max(5),
    }),
  )
  .min(EN_AZ_ADIM)
  .max(EN_COK_ADIM);

export interface RoadmapStepData {
  order: number;
  title: string;
  description: string;
  estimatedHours: number;
  resources: string[];
}

/**
 * AI profil analizini prompt'a hazırlar (#410).
 *
 * ⚠️ BU BLOK BUGÜNE KADAR HİÇ YOKTU. Prompt yalnız üç şey görüyordu:
 * `experienceLevel`, `interests`, `goals`. Oysa platform her stajyer için
 * #47'de zengin bir analiz üretip KALICI OLARAK saklıyor — `strengths`,
 * `developmentAreas`, `recommendedPath`. Bu tam olarak "yol haritası neye
 * göre ayarlanmalı" sorusunun cevabı ve yol haritası üretimi ona hiç
 * bakmıyordu. `recommendedPath` zaten "bu öğrenci hangi sırayla ilerlemeli"
 * diyor; üretim onu yok sayıp sıfırdan uyduruyordu.
 *
 * ⚠️ ANALİZ YOKSA AKIŞ ÇÖKMEZ, bugünkü davranışa düşer. Analiz henüz
 * üretilmemiş olabilir ya da rıza geri alınınca SİLİNMİŞ olabilir (#352).
 *
 * ⚠️ Analiz metinleri de MODEL ÇIKTISI, yani dolaylı olarak kullanıcı
 * metninden türüyor — `veriBlogu` ile sarılıyorlar (#390).
 */

function analizBlogu(analiz?: YolHaritasiAnalizi | null): string {
  if (!analiz) return "";

  const parcalar = [
    analiz.developmentAreas.length > 0
      ? veriBlogu("- Geliştirmesi gereken alanlar", guvenliListe(analiz.developmentAreas))
      : null,
    analiz.strengths.length > 0
      ? veriBlogu("- Güçlü yönleri", guvenliListe(analiz.strengths))
      : null,
    analiz.recommendedPath
      ? veriBlogu("- Önerilen ilerleme yolu", guvenliMetin(analiz.recommendedPath))
      : null,
  ].filter(Boolean);

  if (parcalar.length === 0) return "";

  // Ayraç şablon değişmezi: bloklar arasına gerçek satır sonu koyuyor.
  const arasi = `
`;

  return `
      ÖĞRENCİ ANALİZİ (daha önce üretilmiş değerlendirme):
${parcalar.join(arasi)}
      Yol haritasını ÖZELLİKLE geliştirmesi gereken alanlara göre ayarla ve
      önerilen ilerleme yoluyla tutarlı ol.
`;
}

/**
 * Modelin verdiği sırayı koruyup numaraları 1..n olarak YENİDEN yazar.
 *
 * ⚠️ MODELİN `order` DEĞERİ VERİTABANINA OLDUĞU GİBİ YAZILIYORDU. Model
 * `1, 1, 3` döndürürse bu değerler aynen kaydediliyor; `sort` kararlı
 * olduğu için hata görünmüyor, sıra sessizce bozuk kalıyordu.
 *
 * Bu doğrudan #406 ile çakışıyordu: adım sıralama özelliği `order`
 * değerlerinin TEKİL olduğunu varsayıyor. `siralama.ts` yazarken de
 * onarıyor ama bozuk veri hiç oluşmamalı.
 *
 * Sıralama önce modelin `order`'ına göre; eşitlikte modelin DÖNDÜRDÜĞÜ
 * SIRA korunuyor (kararlı sıralama) — model adımları zaten mantıklı bir
 * sırada yazıyor, yinelenen numara onu bozmamalı.
 */
export function sirayiYenidenNumarala<T extends { order: number }>(adimlar: T[]): T[] {
  return adimlar
    .map((adim, i) => ({ adim, i }))
    .sort((a, b) => a.adim.order - b.adim.order || a.i - b.i)
    .map(({ adim }, i) => ({ ...adim, order: i + 1 }));
}

/**
 * #47'de üretilip saklanan AI profil analizi — yol haritasının en zengin girdisi.
 *
 * Alanlar isteğe bağlı: analiz henüz üretilmemiş ya da rıza yokken silinmiş
 * olabilir (#352). Yokluğu akışı ÇÖKMEZ.
 */
export type YolHaritasiAnalizi = {
  strengths: string[];
  developmentAreas: string[];
  recommendedPath: string;
};

export async function generateRoadmap(
  studentProfile: StudentProfile,
  projectTemplate: ProjectTemplate,
  analiz?: YolHaritasiAnalizi | null,
): Promise<RoadmapStepData[]> {
  try {
    const model = getModel();

    /*
     * #390: Serbest metin alanları AYRAÇLI BLOĞA sarılıyor.
     *
     * Öncesi doğrudan `${...}` ile gömülüydü; stajyer `goals` alanına talimat
     * yazarak üretilen yol haritasını yönlendirebilirdi. #320 bu korumayı
     * kurmuştu ama bu dosyaya uygulanmamıştı.
     *
     * ⚠️ Proje başlığı/açıklaması da KULLANICI METNİ olabilir: #366'dan beri
     * stajyerin kendi önerisinden türeyen şablonlar var (`fromProposal`).
     */
    const interests = Array.isArray(studentProfile.interests)
      ? studentProfile.interests
      : [String(studentProfile.interests)];

    const prompt = `
      Sen kıdemli bir teknik eğitmen ve yazılım mimarısın.
      Aşağıda profili verilen öğrenciye, belirtilen projeyi sıfırdan tamamlayabilmesi için
      adım adım bir öğrenme ve geliştirme yol haritası (roadmap) çıkarman gerekiyor.

      ÖĞRENCİ PROFİLİ:
      - Seviye: ${experienceLevelLabel(studentProfile.experienceLevel)}
      ${veriBlogu("- İlgi Alanları", guvenliListe(interests))}
      ${veriBlogu("- Hedefler", guvenliMetin(studentProfile.goals))}
${analizBlogu(analiz)}
      PROJE BİLGİLERİ:
      ${veriBlogu("- Proje Adı", guvenliMetin(projectTemplate.title, 200))}
      ${veriBlogu("- Açıklama", guvenliMetin(projectTemplate.description))}
      ${veriBlogu("- Teknolojiler (Track)", guvenliListe(projectTemplate.track))}
      - Zorluk: ${projectTemplate.difficulty}

      GÖREV:
      Bu projeyi başarıyla bitirebilmesi için öğrenciye ${EN_AZ_ADIM} ila ${EN_COK_ADIM} adım (step) arasında, mantıklı bir sıralamaya sahip bir yol haritası oluştur.
      Her adımın bir başlığı, ne yapılması gerektiğini anlatan bir açıklaması ve tahmini süresi (saat cinsinden, 1-60 arası) olmalı.

      KAYNAKLAR İÇİN: her adıma 1-2 adet ARAMA TERİMİ yaz (örn: "React useEffect cleanup", "Prisma migration expand contract").
      URL UYDURMA. Var olan bir belgenin adresinden %100 emin değilsen link yerine arama terimi ver —
      çalışmayan bir bağlantı, hiç bağlantı olmamasından daha kötüdür.

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

    return sirayiYenidenNumarala(roadmapSteps);

  } catch (error) {
    logger.error("Roadmap oluşturulurken hata", error);
    throw new Error("Yol haritası üretilemedi. Lütfen daha sonra tekrar deneyin.");
  }
}
