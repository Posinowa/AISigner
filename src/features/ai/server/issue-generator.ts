import { getModel } from "@/lib/ai/gemini-client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type GeneratedIssueSpec = {
  title: string;
  bodyMarkdown: string;
};

/**
 * Bir RoadmapStep (Ana Faz) başlık ve açıklamasını alarak, öğrencinin deneyim seviyesine uygun
 * 3-4 adet somut, kabul kriterli (checklist) ve teknik detaylı GitHub Issue spesifikasyonu üretir.
 */
export async function generateStepIssues(params: {
  stepId: string;
  stepTitle: string;
  stepDescription: string;
  projectTitle: string;
  experienceLevel: string;
}): Promise<GeneratedIssueSpec[]> {
  const { stepId, stepTitle, stepDescription, projectTitle, experienceLevel } = params;

  try {
    const model = getModel();
    const prompt = `
Sen kıdemli biryazılım mimarısın. "${projectTitle}" projesindeki "${stepTitle}" (${stepDescription}) ana fazını, ${experienceLevel} seviyesindeki bir stajyer/öğrenci için 3 ile 4 arasında somut, uygulamaya dayalı GitHub Issue'larına bölmelisin.

Her Issue şunları içermelidir:
1. "title": Aksiyon odaklı net başlık (örn: "[Auth] #1.1 - Argon2 Şifreleme ve Zod Şema Doğrulaması")
2. "bodyMarkdown": Zengin Markdown metni:
   - **📝 Görev Özeti**: Ne yapılacağını anlatan özet
   - **🛠️ Teknik İpuçları & Dosya Yolları**: Dokunulacak dosyalar ve paketler
   - **✅ Kabul Kriterleri (Acceptance Criteria)**: GitHub checklist formatında \`- [ ]\` kutucukları
   - **🧪 Test Beklentisi**: Yazılması gereken birim/entegrasyon testleri

JSON Formatı:
[
  {
    "title": "string",
    "bodyMarkdown": "string"
  }
]
`;

    const response = await model.generateContent(prompt);
    const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("AI yanıtı boş geldi");
    }

    const issues: GeneratedIssueSpec[] = JSON.parse(text);

    // DB'ye kaydet
    await storeGeneratedIssues(stepId, issues);
    return issues;
  } catch (error) {
    logger.error("AI Issue üretimi başarısız oldu, mock fallback kullanılıyor", { error });
    const fallbackIssues = getMockIssues(stepTitle, experienceLevel);
    await storeGeneratedIssues(stepId, fallbackIssues);
    return fallbackIssues;
  }
}

async function storeGeneratedIssues(stepId: string, issues: GeneratedIssueSpec[]) {
  // #218 review [P1]: GitHub'a GÖNDERİLMİŞ (githubIssueUrl dolu) kayıtlar SİLİNMEZ.
  //
  // Eskiden koşulsuz `deleteMany` yapılıyordu; bu, provisioning'in idempotency
  // sözleşmesini bozuyordu (URL'ler silinince re-run duplicate GitHub issue açıyor,
  // öğrencinin mevcut görev linkleri kayboluyordu). Yalnızca henüz gönderilmemiş
  // taslak satırlar tazelenir.
  await prisma.stepIssue.deleteMany({
    where: { stepId, githubIssueUrl: null },
  });

  // Korunan (gönderilmiş) kayıtların sırasını bozmamak için order'ı onların
  // ardından devam ettir.
  const preserved = await prisma.stepIssue.findMany({
    where: { stepId },
    select: { order: true },
    orderBy: { order: "desc" },
    take: 1,
  });
  const orderOffset = preserved[0]?.order ?? 0;

  // Yeni üretilenleri ekle
  await prisma.stepIssue.createMany({
    data: issues.map((issue, index) => ({
      stepId,
      order: orderOffset + index + 1,
      title: issue.title,
      bodyMarkdown: issue.bodyMarkdown,
    })),
  });
}

function getMockIssues(stepTitle: string, experienceLevel: string): GeneratedIssueSpec[] {
  return [
    {
      title: `[${stepTitle}] #1 - Temel Altyapı ve Veri Modellerinin Hazırlanması`,
      bodyMarkdown: `### 📝 Görev Özeti
${stepTitle} fazı için gerekli veri modellerinin ve Zod doğrulama şemalarının kurulması. (Seviye: ${experienceLevel})

### 🛠️ Teknik İpuçları & Dosya Yolları
- \`prisma/schema.prisma\` şemalarını kontrol edin.
- \`src/lib/validations/api.ts\` altına Zod doğrulamasını ekleyin.

### ✅ Kabul Kriterleri (Acceptance Criteria)
- [ ] Gerekli veri modelleri ve Prisma migrasyonu oluşturuldu.
- [ ] API istek parametreleri Zod şeması ile doğrulandı.

### 🧪 Test Beklentisi
- Zod şemalarının geçerli ve geçersiz veriler üzerindeki birim testlerini yazın.`,
    },
    {
      title: `[${stepTitle}] #2 - API Uç Noktalarının ve İş Mantığının (Business Logic) Geliştirilmesi`,
      bodyMarkdown: `### 📝 Görev Özeti
${stepTitle} adımı kapsamındaki API route handler fonksiyonlarının yazılması.

### 🛠️ Teknik İpuçları & Dosya Yolları
- \`src/app/api/\` dizininde ilgili route.ts dosyasını oluşturun.
- Yetki kontrolü için \`requireAuth\` kullanın.

### ✅ Kabul Kriterleri (Acceptance Criteria)
- [ ] Başarılı istekte 200/201 status kodu dönüyor.
- [ ] Yetkisiz kullanıcı isteklerinde 401/403 status kodu alınıyor.

### 🧪 Test Beklentisi
- API route handler fonksiyonu için Vitest entegrasyon testi yazın.`,
    },
    {
      title: `[${stepTitle}] #3 - UI Bileşenleri ve Kullanıcı Deneyimi Entegrasyonu`,
      bodyMarkdown: `### 📝 Görev Özeti
${stepTitle} verilerinin kullanıcı arayüzünde gösterilmesi ve form etkileşimlerinin tamamlanması.

### 🛠️ Teknik İpuçları & Dosya Yolları
- TailwindCSS ve shadcn/ui bileşenlerini kullanın.
- Hata durumunda Toast (\`sonner\`) bildirimlerini bağlayın.

### ✅ Kabul Kriterleri (Acceptance Criteria)
- [ ] Form submit edildiğinde loading indicator (spinner) gösteriliyor.
- [ ] Mobil ve masaüstü ekranlarda arayüz düzgün görüntüleniyor.

### 🧪 Test Beklentisi
- UI bileşeni render ve etkileşim testini tamamlayın.`,
    },
  ];
}
