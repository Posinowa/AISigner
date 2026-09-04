import { GoogleGenAI } from "@google/genai";
import path from "path";
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
const VARSAYILAN_MODEL = "gemini-2.5-flash";

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

  istemci = new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: LOCATION,
    googleAuthOptions: {
      keyFilename: path.resolve(process.cwd(), CREDENTIALS_PATH),
    },
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
