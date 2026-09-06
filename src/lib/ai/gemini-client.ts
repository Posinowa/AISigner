import { GoogleGenAI } from "@google/genai";
import { existsSync } from "fs";
import path from "path";
import { VARSAYILAN_MODEL } from "./model-adi";

export { VARSAYILAN_MODEL };
import { yenidenDene } from "./yeniden-dene";

/**
 * Gemini istemcisi (#335).
 *
 * ⚠️ SDK GEÇİŞİ: Önceden `@google-cloud/vertexai` kullanılıyordu. O SDK
 * 24 Haziran 2025'te deprecate edildi ve **24 Haziran 2026'da kaldırılacağı**
 * duyurulmuştu — yani bu geçiş yapıldığında tarih çoktan geçmişti ve entegrasyon
 * Google'ın insafına kalmış durumdaydı. `@google/genai` resmî halefidir.
 *
 * MİMARİ: Bu dosya, SDK detayını bilen TEK yerdir. Dışarıya normalize edilmiş
 * bir arayüz veriyor (`{ text }`), böylece bir sonraki SDK değişiminde yalnız
 * burası değişir. Öncesinde SDK'ya özgü yanıt okuma deseni
 * (`result.response.candidates?.[0]?.content?.parts?.[0]?.text`) beş ayrı
 * dosyada tekrarlanıyordu.
 */

const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const CREDENTIALS_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "gcp-credentials.json";

/**
 * Kimlik DOSYASI mı kullanılacak, ADC mi? (#522)
 *
 * ⚠️ ÖNCESİ HER KOŞULDA DOSYA İSTİYORDU ve bu, Google Cloud'da (Cloud Run)
 * doğru yöntemin tam tersi: orada kimlik servisin kendi service account'undan
 * **ADC** ile gelir ve ORTADA HİÇ ANAHTAR DOSYASI OLMAZ — saklanacak,
 * dağıtılacak, döndürülecek uzun ömürlü bir sır yok.
 *
 * Dosya yoksa `keyFilename` var olmayan bir yolu gösteriyor, istemci kurulumu
 * patlıyor ve çağıran taraf #335'in graceful degradation'ı gereği MOCK'a
 * düşüyordu. Yani IAM doğru ayarlanmış olsa bile AI **sessizce sahte içerik**
 * üretirdi — #377'nin belgelediği körlüğün dağıtım tarafındaki hâli.
 *
 * ⚠️ TUTARSIZLIK KENDİNİ ELE VERİYORDU: `lib/storage/blob.ts` (GCS) zaten
 * ADC kullanıyor, yalnız `projectId` veriyor. Aynı bulutta iki istemci iki
 * farklı kimlik yöntemindeydi.
 *
 * ⚠️ YEREL GELİŞTİRME KIRILMIYOR: dosya varsa davranış aynen sürüyor.
 *
 * ## ⚠️ ADC KÖRLEMESİNE DENENMEZ — CI'DA ÖLÇÜLDÜ
 *
 * İlk sürüm "dosya yoksa ADC'ye düş" diyordu ve gerekçesi şuydu: platform
 * tespiti yanılabilir, dosyanın varlığı yanılmaz. ÖLÇÜM bunu çürüttü.
 *
 * GCP DIŞINDA `googleAuthOptions` verilmediğinde SDK kimliği aramaya
 * çıkıyor ve metadata sunucusunu (`169.254.169.254`) yokluyor. Orada bir
 * şey olmadığı için istek HATA VERMİYOR, ASILIYOR: CI'da öğrenci panosunu
 * yükleyen üç E2E testi 30 saniyelik zaman aşımına düştü. Yerelde
 * görünmedi çünkü geliştirme makinesinde `gcp-credentials.json` var.
 *
 * Yani asıl mesele "kimlik bulunur mu" değil, BULUNAMAMANIN HIZI: #335'in
 * sözleşmesi hatanın HEMEN fırlatılıp çağıran tarafın mock'a düşmesi.
 * Yavaş bir başarısızlık, graceful degradation'ı sessiz bir kilitlenmeye
 * çeviriyor.
 *
 * Bu yüzden ADC yalnızca gerçekten mümkün olduğunda deneniyor: Cloud Run
 * konteyner sözleşmesi `K_SERVICE`'i garanti ediyor. Ne dosya ne de bu
 * işaret varsa HEMEN fırlatılıyor.
 */

/** Cloud Run'ın konteynere enjekte ettiği işaret (konteyner sözleşmesi). */
function cloudRunUzerindeMi(): boolean {
  return Boolean(process.env.K_SERVICE?.trim());
}

function kimlikDosyasiYolu(): string | null {
  const yol = path.resolve(process.cwd(), CREDENTIALS_PATH);
  return existsSync(yol) ? yol : null;
}


/** Çağrı yerlerinin gördüğü normalize yanıt. SDK şekli buraya sızmaz. */
export type AiYanit = { text: string };

/** Sohbet geçmişi öğesi (SDK ile aynı şekil, ama sözleşme bizim). */
export type SohbetIcerigi = { role: string; parts: { text: string }[] };

let istemci: GoogleGenAI | null = null;

function getIstemci(): GoogleGenAI {
  if (istemci) return istemci;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    // Sözleşme korunuyor: kimlik yoksa FIRLATILIR ve çağıran taraf mock'a düşer
    // (graceful degradation). Bu davranış #335'te bilerek değiştirilmedi.
    throw new Error(
      "GOOGLE_CLOUD_PROJECT ortam değişkeni tanımlı değil. .env dosyanızı kontrol edin.",
    );
  }

  const anahtarDosyasi = kimlikDosyasiYolu();

  if (!anahtarDosyasi && !cloudRunUzerindeMi()) {
    /*
     * ⚠️ HIZLI FIRLAT — ADC'yi yoklamaya BIRAKMA. Gerekçe yukarıda:
     * yoklama GCP dışında hata vermeden asılıyor ve #335'in "hemen mock'a
     * düş" sözleşmesini 30 saniyelik bir kilitlenmeye çeviriyor.
     */
    throw new Error(
      "Vertex AI kimliği yok: ne gcp-credentials.json var ne de Cloud Run üzerindeyiz (K_SERVICE tanımsız).",
    );
  }

  istemci = new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: LOCATION,
    /*
     * Dosya yoksa `googleAuthOptions` HİÇ verilmiyor — SDK kimliği ADC'den
     * çözer (Cloud Run'da servisin service account'u). Boş bir nesne ya da
     * `keyFilename: undefined` göndermek aynı şey değil: SDK'nın hangi
     * varsayılanları uygulayacağını belirsizleştirirdi.
     */
    ...(anahtarDosyasi ? { googleAuthOptions: { keyFilename: anahtarDosyasi } } : {}),
  });

  return istemci;
}

/** Yalnızca testler için: modül düzeyindeki istemciyi sıfırlar. */
export function resetClientForTests(): void {
  istemci = null;
}

function modelSarmalayici(modelName: string, jsonModu: boolean) {
  const config = jsonModu ? { responseMimeType: "application/json" } : undefined;

  return {
    /**
     * Düz metin ya da `{ contents: [...] }` biçimini kabul eder — mevcut çağrı
     * yerleri iki şekli de kullanıyordu, ikisi de korunuyor.
     */
    async generateContent(
      girdi: string | { contents: SohbetIcerigi[] },
    ): Promise<AiYanit> {
      /*
       * ⚠️ YENİDEN DENEME BURADA — çağrı yerlerinde DEĞİL (#471).
       *
       * SDK'yı çağıran tek yer burası; sekiz ayrı modül bu sarmalayıcıdan
       * geçiyor. Retry'ı çağrı yerlerine dağıtmak, `veriBlogu`'nun (#390)
       * ve rıza kontrolünün (#389) başına gelenin aynısını yapardı:
       * kural bir yerde unutulur ve o uç sessizce korumasız kalır.
       */
      return yenidenDene(
        async () => {
          const yanit = await getIstemci().models.generateContent({
            model: modelName,
            contents: typeof girdi === "string" ? girdi : girdi.contents,
            ...(config ? { config } : {}),
          });
          return { text: yanit.text ?? "" };
        },
        { kapsam: "generateContent" },
      );
    },

    /** Sohbet oturumu (AI chat için). */
    startChat(secenekler: { history: SohbetIcerigi[] }) {
      const sohbet = getIstemci().chats.create({
        model: modelName,
        history: secenekler.history,
        ...(config ? { config } : {}),
      });

      return {
        async sendMessage(mesaj: string): Promise<AiYanit> {
          return yenidenDene(
            async () => {
              const yanit = await sohbet.sendMessage({ message: mesaj });
              return { text: yanit.text ?? "" };
            },
            { kapsam: "sendMessage" },
          );
        },
      };
    },
  };
}

/** JSON döndüren modeller için (responseMimeType=application/json). */
export function getModel(modelName: string = VARSAYILAN_MODEL) {
  return modelSarmalayici(modelName, true);
}

/** Düz metin döndüren modeller için (chat vb.). */
export function getTextModel(modelName: string = VARSAYILAN_MODEL) {
  return modelSarmalayici(modelName, false);
}
