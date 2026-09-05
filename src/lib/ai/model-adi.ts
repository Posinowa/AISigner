/**
 * Varsayılan Gemini modelinin adı — TEK KAYNAK (#494).
 *
 * ⚠️ NEDEN AYRI DOSYA: `gemini-client.ts` SDK'yı kuruyor ve testlerin
 * çoğunda MOCK'LANIYOR. Sabit orada dururken üretim kökeni onu import
 * edince, mock'ta bu ad tanımlı olmadığı için import PATLIYOR ve akış
 * sessizce yedek (mock) analize düşüyordu — testler bunu "gerçek AI
 * kullanılmadı" diye yakaladı.
 *
 * Yan etkisi olmayan bu dosyayı kimse mock'lamıyor; hem istemci hem köken
 * modülü buradan okuyor, yani ad hâlâ TEK yerde tanımlı.
 */
export const VARSAYILAN_MODEL = "gemini-2.5-flash";
