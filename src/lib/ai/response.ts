import type { ZodType } from "zod";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";

/**
 * AI yanıtının çözümlenmesi: metin çıkarımı → temizlik → JSON → DOĞRULAMA.
 *
 * NEDEN MERKEZİ (#335): Bu zincir beş ayrı dosyada, birbirinden hafifçe farklı
 * şekilde tekrarlanıyordu. İki sonucu vardı:
 *
 * 1. SDK'ya özgü yanıt okuma deseni
 *    (`result.response.candidates?.[0]?.content?.parts?.[0]?.text`) beş yerde
 *    geçtiği için SDK değişiminde beş yerde birden kırılıyordu.
 * 2. Hiçbirinde çıktının ŞEKLİ doğrulanmıyordu — tip yalnızca `as` ile
 *    varsayılıyordu.
 *
 * NEDEN DOĞRULAMA (#320): Model beklenmeyen bir şekil döndürdüğünde çağıran
 * taraftaki `try/catch` mock içeriğe düşüyordu. Uygulama çökmüyor ama kimse de
 * fark etmiyordu — kullanıcı jenerik içerik alıyor ve bunu gerçek AI çıktısından
 * ayırt edemiyordu. Artık düşüş SESSİZ DEĞİL: sayaç artıyor ve loglanıyor.
 */

/**
 * Yanıt gövdesinden düz metni çıkarır.
 *
 * İki şekli de kabul eder:
 * - `{ text }` — `gemini-client`'ın normalize ettiği şekil (NORMAL yol)
 * - `{ response: { candidates: [...] } }` — ham SDK şekli
 *
 * ⚠️ İkincisi neden duruyor: bu fonksiyon önce YALNIZCA ham şekli okuyordu.
 * İstemci normalize `{ text }` döndürmeye başlayınca `cozVeDogrula` kullanan
 * her modül sessizce boş metin alıp mock'a düşüyordu — yani profil analizi,
 * yol haritası ve proje önerileri üretimde HİÇ gerçek AI çıktısı
 * kullanamayacaktı. Testler yakaladı. Her iki şekli desteklemek, ileride bir
 * çağrı yerinin ham yanıtı geçirmesi durumunda da aynı sessiz kırılmayı
 * önlüyor.
 */
export function metinAl(sonuc: unknown): string {
  const r = sonuc as {
    text?: string;
    response?: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
  };

  if (typeof r?.text === "string") return r.text;
  return r?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/**
 * Model çıktısındaki JSON'ı ayıklar.
 *
 * `responseMimeType: application/json` istense bile model zaman zaman metni
 * ```json bloğuna sarıyor ya da başına açıklama ekliyor. Bu yüzden hem kod
 * bloğu işaretleri temizleniyor hem de ilk `{`/`[` ile son `}`/`]` arası
 * alınıyor.
 */
export function jsonAyikla(ham: string): string {
  let metin = ham.replace(/```json/gi, "").replace(/```/g, "").trim();

  const nesneBas = metin.indexOf("{");
  const diziBas = metin.indexOf("[");
  // Hangisi önce geliyorsa kök odur.
  const bas =
    diziBas !== -1 && (nesneBas === -1 || diziBas < nesneBas) ? diziBas : nesneBas;
  const son = Math.max(metin.lastIndexOf("}"), metin.lastIndexOf("]"));

  if (bas !== -1 && son !== -1 && son > bas) {
    metin = metin.substring(bas, son + 1);
  }
  return metin;
}

/** Doğrulama başarısız olduğunda fırlatılır — çağıran mock'a düşebilsin diye. */
export class AiCiktiGecersizError extends Error {
  constructor(
    message: string,
    readonly kaynak: string,
  ) {
    super(message);
    this.name = "AiCiktiGecersizError";
  }
}

/**
 * Yanıtı çözüp `sema` ile doğrular.
 *
 * @param kaynak metrik/log etiketi (ör. "profile-analysis")
 * @throws AiCiktiGecersizError metin boşsa, JSON bozuksa veya şema tutmazsa
 */
export function cozVeDogrula<T>(sonuc: unknown, sema: ZodType<T>, kaynak: string): T {
  const ham = metinAl(sonuc);

  if (!ham.trim()) {
    gorunurBasarisizlik(kaynak, "bos-yanit");
    throw new AiCiktiGecersizError("AI yanıtı boş geldi", kaynak);
  }

  let cozulen: unknown;
  try {
    cozulen = JSON.parse(jsonAyikla(ham));
  } catch {
    gorunurBasarisizlik(kaynak, "gecersiz-json");
    throw new AiCiktiGecersizError("AI yanıtı geçerli JSON değil", kaynak);
  }

  const sonucDogrulama = sema.safeParse(cozulen);
  if (!sonucDogrulama.success) {
    gorunurBasarisizlik(kaynak, "sema-uyusmadi");
    throw new AiCiktiGecersizError(
      `AI çıktısı beklenen şekilde değil: ${sonucDogrulama.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      kaynak,
    );
  }

  incrementCounter(`ai.${kaynak}.basarili`);
  return sonucDogrulama.data;
}

/**
 * Mock'a düşüşü GÖRÜNÜR kılar.
 *
 * Sessiz düşüş bu kod tabanındaki asıl sorundu: kullanıcı jenerik içerik alıyor,
 * hiçbir yerde hata görünmüyordu. Sayaç + uyarı logu, operasyonda "AI ne sıklıkla
 * işe yaramıyor" sorusunu cevaplanabilir yapıyor.
 */
function gorunurBasarisizlik(kaynak: string, neden: string): void {
  incrementCounter(`ai.${kaynak}.fallback`);
  incrementCounter(`ai.${kaynak}.fallback.${neden}`);
  logger.warn("AI çıktısı kullanılamadı, mock içeriğe düşülüyor", { kaynak, neden });
}
