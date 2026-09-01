import "server-only";
import { z } from "zod";
import { getModel } from "@/lib/ai/gemini-client";
import { cozVeDogrula } from "@/lib/ai/response";
import { guvenliMetin, guvenliListe, veriBlogu } from "@/lib/ai/prompt";
import { experienceLevelLabel } from "@/lib/experience-level";

/**
 * Mentör–stajyer eşleştirme sıralaması (#328).
 *
 * AŞAMA 1 — pgvector YOK. `MentorAnalysis.idealStudentProfile` (#288) ve
 * `ProfileAnalysis` zaten anlamsal malzemeyi üretiyor; eksik olan tek şey
 * sıralamaydı. Tek bir LLM çağrısı, sıfır yeni altyapıyla değerin çoğunu
 * veriyor. Gömme (embedding) tabanlı skor ancak aday sayısı elle
 * sıralanamayacak kadar büyürse gerekir.
 *
 * ⚠️ YÜZDE SKOR ÜRETİLMİYOR — bilinçli.
 * "%88 uyum" gibi bir sayı, arkasında ölçülmüş hiçbir şey yokken kesinlik
 * hissi verir; admin'i sorgulamadan güvenmeye iter ve iki mentör arasındaki
 * 3 puanlık farkı anlamlıymış gibi gösterir. Bunun yerine model kaba bir BANT
 * seçiyor ve GEREKÇE yazmak zorunda: karar admin'de kalsın diye okunacak şey
 * sayı değil, gerekçe.
 */

const UyumSemasi = z.enum(["guclu", "olasi", "zayif"]);

const SiralamaSemasi = z.object({
  oneriler: z
    .array(
      z.object({
        mentorId: z.string().min(1),
        uyum: UyumSemasi,
        gerekce: z.string().min(1).max(600),
        /** Modelin çekincesi — "neden emin değilim". Boş olabilir. */
        cekince: z.string().max(400).nullable().optional(),
      }),
    )
    .max(3),
});

export type Uyum = z.infer<typeof UyumSemasi>;
export type Siralama = z.infer<typeof SiralamaSemasi>;

export type OgrenciGirdisi = {
  deneyimSeviyesi: string | null;
  ilgiAlanlari: string[];
  hedefler: string | null;
  analizOzeti: string | null;
  guclüYonler: string[];
  gelisimAlanlari: string[];
  teknikAlanlar: string[];
};

export type MentorAdayi = {
  mentorId: string;
  seviye: string;
  ozet: string;
  guclüYonler: string[];
  teknikAlanlar: string[];
  idealStajyerProfili: string;
  eslestirmeNotlari: string[];
};

/** Bir aday listesini öğrenciye göre sıralar. En fazla 3 öneri döner. */
export async function mentorleriSirala(
  ogrenci: OgrenciGirdisi,
  adaylar: MentorAdayi[],
): Promise<Siralama> {
  const adayBloklari = adaylar
    .map((m) =>
      [
        `mentorId: ${m.mentorId}`,
        `Seviye: ${guvenliMetin(m.seviye, 100)}`,
        `Özet: ${guvenliMetin(m.ozet, 1200)}`,
        `Güçlü yönler: ${guvenliListe(m.guclüYonler)}`,
        `Teknik alanlar: ${guvenliListe(m.teknikAlanlar)}`,
        `Uygun olduğu stajyer profili: ${guvenliMetin(m.idealStajyerProfili, 1200)}`,
        `Eşleştirme notları: ${guvenliListe(m.eslestirmeNotlari)}`,
      ].join("\n"),
    )
    .join("\n---\n");

  const prompt = `Sen bir stajyer platformunda mentör–stajyer eşleştirmesi yapan bir
danışmansın. Aşağıdaki stajyer için, verilen mentör adayları arasından EN UYGUN
EN FAZLA 3 tanesini seç ve sırala.

KURALLAR — harfiyen uy:
- YALNIZCA sana verilen "mentorId" değerlerini kullan. Listede olmayan bir
  kimlik UYDURMA.
- Gerçekten uygun aday yoksa daha AZ öneri ver, hatta hiç verme. Listeyi
  doldurmak için zayıf adayları öne sürme.
- Her öneri için GEREKÇE yaz: stajyerin hangi ihtiyacı, mentörün hangi
  özelliğiyle karşılanıyor. Genel geçer övgü yazma ("çok deneyimli" gibi),
  somut örtüşmeyi göster.
- Emin olmadığın bir nokta varsa "cekince" alanına yaz. Boş bırakmaktan
  çekinme ama gerçek bir çekince varsa MUTLAKA yaz — bu öneri bir insanın
  kararına girdi olacak.
- Türkçe yaz.

"uyum" değerleri (yüzde verme, bu üç banttan birini seç):
- "guclu": stajyerin ihtiyaçlarıyla mentörün alanları açıkça örtüşüyor
- "olasi": kısmi örtüşme var, mentörün başka güçlü yönleri telafi edebilir
- "zayif": belirgin bir örtüşme göremiyorum

${veriBlogu(
  "STAJYER",
  [
    `Deneyim seviyesi: ${experienceLevelLabel(ogrenci.deneyimSeviyesi)}`,
    `İlgi alanları: ${guvenliListe(ogrenci.ilgiAlanlari)}`,
    `Hedefleri: ${guvenliMetin(ogrenci.hedefler, 1500)}`,
    `AI profil analizi: ${guvenliMetin(ogrenci.analizOzeti, 1500)}`,
    `Güçlü yönleri: ${guvenliListe(ogrenci.guclüYonler)}`,
    `Gelişim alanları: ${guvenliListe(ogrenci.gelisimAlanlari)}`,
    `Teknik alanları: ${guvenliListe(ogrenci.teknikAlanlar)}`,
  ].join("\n"),
)}

${veriBlogu("MENTÖR ADAYLARI", adayBloklari)}

Yanıtı SADECE şu JSON şeklinde ver:
{
  "oneriler": [
    {
      "mentorId": "verilen listeden birebir kopyalanmış kimlik",
      "uyum": "guclu|olasi|zayif",
      "gerekce": "somut örtüşme açıklaması",
      "cekince": "varsa çekince, yoksa null"
    }
  ]
}`;

  const yanit = await getModel().generateContent(prompt);
  return cozVeDogrula(yanit, SiralamaSemasi, "mentor-matching");
}
