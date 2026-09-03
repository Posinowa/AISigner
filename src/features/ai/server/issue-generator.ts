import { z } from "zod";
import { guvenliMetin, guvenliListe, veriBlogu } from "@/lib/ai/prompt";
import { getModel } from "@/lib/ai/gemini-client";
import { cozVeDogrula, AiCiktiGecersizError } from "@/lib/ai/response";
import { sinirla, ALAN_SINIRI } from "@/lib/ai/truncate";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type GeneratedIssueSpec = {
  title: string;
  bodyMarkdown: string;
};

/**
 * #377: Model çıktısının ŞEKLİ doğrulanıyor.
 *
 * Öncesinde ham `JSON.parse(text)` vardı. Model — `responseMimeType` istense
 * bile — çıktıyı ```json bloğuna sarabiliyor ya da başına açıklama
 * ekleyebiliyor (#335'in kurduğu `cozVeDogrula` tam bunun için var). O
 * durumda `JSON.parse` SyntaxError fırlatıyor ve akış SESSİZCE mock
 * içeriğe düşüyordu: mentör/öğrenci uydurma issue başlıklarıyla çalışıyor,
 * bunu gerçek AI çıktısından ayırt edemiyordu.
 *
 * Boş liste de reddediliyor: "issue üretildi" denip hiçbir şey üretmemek,
 * mock'a düşmekten daha sinsi bir sessiz başarısızlık olurdu.
 */
const issueSemasi = z
  .array(
    z.object({
      title: z.string().trim().min(1),
      bodyMarkdown: z.string().trim().min(1),
    }),
  )
  .min(1);

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
Sen kıdemli bir yazılım mimarısın. Aşağıdaki proje ve fazı, ${experienceLevel} seviyesindeki bir stajyer/öğrenci için 3 ile 4 arasında somut, uygulamaya dayalı GitHub Issue'larına bölmelisin.

${veriBlogu("PROJE", guvenliMetin(projectTitle, 200))}
${veriBlogu("FAZ BAŞLIĞI", guvenliMetin(stepTitle, 200))}
${veriBlogu("FAZ AÇIKLAMASI", guvenliMetin(stepDescription))}

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

    // #377: Metin çıkarımı + kod bloğu temizliği + JSON + şema doğrulaması
    // tek yerden. Boş yanıt da burada yakalanıyor.
    const issues: GeneratedIssueSpec[] = cozVeDogrula(
      response,
      issueSemasi,
      "issue-generator",
    );

    // DB'ye kaydet
    await storeGeneratedIssues(stepId, issues);
    return issues;
  } catch (error) {
    // ⚠️ DÜŞÜŞ SESSİZ DEĞİL. `cozVeDogrula` sayacı da artırıyor (#335), ama
    // burada da açıkça loglanıyor: mock içerik üretime karıştığında bunun
    // izlenebilir olması gerekiyor.
    logger.error("AI Issue üretimi başarısız oldu, mock fallback kullanılıyor", {
      error: error instanceof Error ? error.message : String(error),
      dogrulama: error instanceof AiCiktiGecersizError ? error.kaynak : undefined,
    });
    const fallbackIssues = getMockIssues(stepTitle, experienceLevel);
    await storeGeneratedIssues(stepId, fallbackIssues);
    return fallbackIssues;
  }
}

async function storeGeneratedIssues(stepId: string, issues: GeneratedIssueSpec[]) {
  // #269: GitHub'a GÖNDERİLMİŞ kayıtlar korunur.
  //
  // Önceden bu silme `where: { stepId }` idi ve adımdaki tüm kayıtları —
  // `githubIssueUrl` dahil — siliyordu. Provisioning her çalıştığında AI'ı
  // yeniden çağırdığı için: bağlantılar kayboluyor, yeni üretilen başlıklar
  // farklı olduğunda GitHub'da KOPYA issue açılıyordu.
  //
  // Asıl koruma çağıran tarafta (provisioning artık gönderilmiş adımda AI'ı
  // hiç çağırmıyor); burası savunma derinliği.
  await prisma.stepIssue.deleteMany({
    where: { stepId, githubIssueUrl: null },
  });

  // Korunan kayıtların order'ı bozulmasın: yeni satırlar onların ardından
  // numaralanır.
  const korunanSayisi = await prisma.stepIssue.count({ where: { stepId } });

  await prisma.stepIssue.createMany({
    data: issues.map((issue, index) => ({
      stepId,
      order: korunanSayisi + index + 1,
      // #318: Şema sınırına göre kırp. Model 4000 karakteri aşan bir gövde
      // ürettiğinde Postgres "right truncated" fırlatıyor; çağrı try/catch
      // içinde olduğu için bu SESSİZCE mock içeriğe düşmeye yol açıyordu.
      title: sinirla(issue.title ?? "", ALAN_SINIRI.issueTitle),
      bodyMarkdown: sinirla(issue.bodyMarkdown ?? "", ALAN_SINIRI.issueBody),
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
