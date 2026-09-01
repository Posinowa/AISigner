import "server-only";
import { z } from "zod";
import { getModel } from "@/lib/ai/gemini-client";
import { cozVeDogrula } from "@/lib/ai/response";
import { guvenliMetin, veriBlogu } from "@/lib/ai/prompt";
import { experienceLevelLabel } from "@/lib/experience-level";
import type { IncelenecekDosya } from "@/features/github/server/pr-diff";

/**
 * PR'lar için AI ön incelemesi üretir (#327).
 *
 * ⚠️ MOCK FALLBACK YOK — bilinçli ve bu kod tabanındaki diğer AI modüllerinden
 * FARKLI. Diğerlerinde model çuvallayınca jenerik içerik üretiliyor, çünkü
 * çıktı yalnızca ilgili kullanıcıya gösteriliyor. Burada çıktı **public bir
 * PR'a yorum olarak yazılıyor**: uydurma bir "inceleme" öğrenciye yanlış geri
 * bildirim vermekle kalmaz, herkesin gördüğü bir yere yazılır. Model
 * kullanılamıyorsa doğru davranış SUSMAK.
 *
 * NEDEN DIFF'TEN FAZLASI GİDİYOR: Adımın açıklaması ve öğrencinin seviyesi de
 * prompt'a giriyor. Genel amaçlı bir inceleme aracının bilemeyeceği tek şey bu
 * ve #327'nin asıl değeri burada: "bu kod kötü" değil, "bu adımda senden
 * beklenen X'ti, kodun Y yapıyor".
 */

/** Bir PR'da yazılacak azami bulgu — PR'ı boğmamak için. */
export const MAKS_BULGU = 6;

const OnemSemasi = z.enum(["bilgi", "oneri", "uyari"]);

const IncelemeSemasi = z.object({
  ozet: z.string().min(1).max(1200),
  bulgular: z
    .array(
      z.object({
        dosya: z.string().max(300),
        onem: OnemSemasi,
        baslik: z.string().min(1).max(200),
        aciklama: z.string().min(1).max(1200),
      }),
    )
    .max(MAKS_BULGU),
});

export type Inceleme = z.infer<typeof IncelemeSemasi>;
export type Onem = z.infer<typeof OnemSemasi>;

export type IncelemeBaglami = {
  projeBasligi: string | null;
  adimBasligi: string | null;
  adimAciklamasi: string | null;
  deneyimSeviyesi: string | null;
  prBasligi: string;
  kirpildi: boolean;
};

function diffMetni(dosyalar: IncelenecekDosya[]): string {
  return dosyalar
    .map((d) => `--- ${d.yol} (${d.durum}) ---\n${d.yama}`)
    .join("\n\n");
}

/**
 * İncelemeyi üretir.
 *
 * @throws AI kullanılamazsa / çıktı doğrulanamazsa. Çağıran taraf SUSMALI.
 */
export async function kodIncelemesiUret(
  dosyalar: IncelenecekDosya[],
  baglam: IncelemeBaglami,
): Promise<Inceleme> {
  const seviye = experienceLevelLabel(baglam.deneyimSeviyesi);

  const prompt = `Sen bir stajyer platformunda çalışan, deneyimli ve ÖĞRETİCİ bir kod
inceleyicisisin. Bir stajyerin açtığı Pull Request'e ön inceleme yazacaksın.

TON KURALLARI — bunlara harfiyen uy:
- Yorumun tamamı herkese AÇIK bir PR'da görünecek. Stajyerin motivasyonunu
  kırmayacak, öğretici bir dil kullan.
- Asla küçümseme, alay veya "bu yanlış" gibi kestirip atan ifade kullanma.
  Bunun yerine nedenini açıkla ve daha iyisini göster.
- Kişiyi değil KODU konuş. "Sen yanlış yapmışsın" değil, "bu satırda şu risk var".
- Övülecek bir şey varsa söyle.
- Emin olmadığın bir şeyi kesinmiş gibi yazma; "olabilir", "kontrol etmekte
  fayda var" gibi ifadeler kullan.
- Türkçe yaz.

NE ARAYACAKSIN (önem sırasıyla):
1. Güvenlik: sabit kodlanmış sır/anahtar, doğrulanmamış girdi, enjeksiyon riski
2. Doğruluk: hatalı mantık, gözden kaçmış uç durum, sızdırılan kaynak
3. Eksik test: davranış değişmiş ama testi yok
4. Proje standartları ve okunabilirlik: isimlendirme, ölü kod, tekrar

EN FAZLA ${MAKS_BULGU} BULGU yaz. Az ama isabetli bulgu, çok ama önemsiz
bulgudan iyidir. Gerçekten söylenecek bir şey yoksa "bulgular" listesini boş
bırak — doldurmak için önemsiz şeyler yazma.

"onem" değerleri:
- "uyari": güvenlik veya doğruluk sorunu, birleştirmeden önce bakılmalı
- "oneri": iyileştirme, birleştirmeyi engellemez
- "bilgi": not, öğretici açıklama

${veriBlogu(
  "İNCELENECEK PR BAŞLIĞI",
  guvenliMetin(baglam.prBasligi, 300),
)}

${veriBlogu(
  "ÖĞRENCİNİN ÜZERİNDE ÇALIŞTIĞI YOL HARİTASI ADIMI",
  [
    `Proje: ${guvenliMetin(baglam.projeBasligi, 200)}`,
    `Adım: ${guvenliMetin(baglam.adimBasligi, 200)}`,
    `Adımın tanımı: ${guvenliMetin(baglam.adimAciklamasi, 1500)}`,
    `Öğrencinin deneyim seviyesi: ${seviye}`,
  ].join("\n"),
)}

Bulguları öğrencinin seviyesine göre ayarla: ${seviye} seviyesinde bir stajyerden
beklenmeyecek ileri düzey mimari eleştirileri öne çıkarma, temel konulara odaklan.

${veriBlogu("DEĞİŞİKLİKLER (unified diff)", diffMetni(dosyalar))}
${baglam.kirpildi ? "\nNOT: Diff bütçe sınırı nedeniyle kırpıldı; değişikliklerin tamamını görmüyor olabilirsin. Görmediğin kod hakkında yorum yapma.\n" : ""}
Yanıtı SADECE şu JSON şeklinde ver:
{
  "ozet": "PR'ın ne yaptığına dair 2-3 cümlelik nötr özet",
  "bulgular": [
    { "dosya": "src/...", "onem": "uyari|oneri|bilgi", "baslik": "kısa başlık", "aciklama": "açıklama ve öneri" }
  ]
}`;

  const yanit = await getModel().generateContent(prompt);
  return cozVeDogrula(yanit, IncelemeSemasi, "code-review");
}
