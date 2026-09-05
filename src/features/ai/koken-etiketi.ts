/**
 * AI analizinin KÖKENİNİN arayüzde nasıl anlatılacağı — tek kaynak (#501).
 *
 * ⚠️ NEDEN VAR: #494 kökeni veritabanına yazdı ama HİÇBİR YÜZEYDE
 * okunmuyordu. Kaydetmek ama söylememek, #405'in tam olarak eleştirdiği
 * durum: orada da "Taslak" rozeti vardı, eksik olan SONUCUNU söyleyen
 * cümleydi ("stajyer hiçbir adımı göremiyor").
 *
 * ⚠️ METİN GÖZLE DE OKUNMALI (#455). İlk sürümde başlık "AI üretmedi —
 * yedek içerik" idi ve bileşen başlıkla açıklamayı yine tire ile
 * birleştirdiği için satır "… yedek içerik — Bu metin …" diye çıkıyordu;
 * açıklama da "Bu metin" ile başlayıp başlığı tekrarlıyordu. İkisi de
 * testlerden GEÇMİŞTİ — metin testleri varlığı ölçer, okunabilirliği değil.
 *
 * ⚠️ Metin BURADA, bileşende değil: köken bugün analiz kartında, yarın
 * mentör analizinde ya da eşleştirme panelinde görünecek. Aynı durumu üç
 * yüzeyde farklı sözcüklerle anlatmak, onları farklı şeyler sanmaya yol
 * açar (#405'in `taslak.ts` kararı).
 *
 * ⚠️ Bu dosya prisma İMPORT ETMEZ ve `server-only` DEĞİL: istemci
 * bileşenleri kullanıyor (#432/#448/#486 ile aynı gerekçe).
 */

import { kokenDurumu, type KokenDurumu } from "@/lib/ai/uretim-kokeni";

export type KokenTonu = "notr" | "uyari" | "hata";

export type KokenEtiketi = {
  durum: KokenDurumu;
  /** Kısa durum ifadesi — rozet metni. */
  baslik: string;
  /** SONUCU söyleyen cümle: okuyan kişi ne yapmalı / neye güvenmemeli. */
  aciklama: string;
  ton: KokenTonu;
};

/**
 * ⚠️ "GÜNCEL" DURUMU DA GÖSTERİLİR ama sessizce (nötr ton). Yalnız sorunlu
 * durumları göstermek, işaretin YOKLUĞUNU iki anlama gelir hâle getirirdi:
 * "her şey yolunda" ile "bu sürüm bu kartta hiç kontrol edilmiyor".
 */
export function kokenEtiketi(
  uretimSurumu: string | null | undefined,
  uretimModeli: string | null | undefined,
): KokenEtiketi {
  const durum = kokenDurumu(uretimSurumu);

  switch (durum) {
    case "guncel":
      return {
        durum,
        baslik: "Güncel AI çıktısı",
        aciklama: `${uretimModeli ?? "model belirtilmemiş"} · ${uretimSurumu}`,
        ton: "notr",
      };

    /*
     * ⚠️ EN AĞIR DURUM BU, "eski" DEĞİL. Yedek içerik bir AI çıktısı
     * değildir: model hiç yanıt vermemiş ya da yanıtı doğrulamayı geçmemiş
     * (#377), platform da elindeki beyandan bir metin türetmiştir. Kart
     * bunu söylemezse mentör/admin uydurma bir değerlendirmeyi analiz
     * sanar — #377'nin belgelediği körlüğün KALICI hâli.
     */
    case "yedek":
      return {
        durum,
        baslik: "Yapay zekâ üretmedi",
        aciklama:
          "Bu metin, model yanıt vermediği için girilen bilgilerden otomatik türetildi. Değerlendirme olarak okumayın; analizi yeniden üretmeyi deneyin.",
        ton: "hata",
      };

    case "eski":
      return {
        durum,
        baslik: "Eski sürümle üretildi",
        aciklama:
          "Bu analiz daha eski bir soru setiyle hazırlandı; sorular o tarihten sonra değişti. Yeniden üretmek daha isabetli bir sonuç verebilir.",
        ton: "uyari",
      };

    /*
     * ⚠️ "BİLİNMİYOR" UYDURULMAZ. Köken sütunları eklenmeden önce üretilmiş
     * kayıtlar geriye doldurulmadı (#494): eski satırların gerçekten hangi
     * sürümle üretildiği bilinmiyor. Onlara "eski" demek, güncel olabilecek
     * analizleri ücretli bir AI çağrısıyla yeniden ürettirirdi.
     */
    case "bilinmiyor":
      return {
        durum,
        baslik: "Kaynağı bilinmiyor",
        aciklama:
          "Bu analiz, kaynak bilgisi tutulmaya başlanmadan önce üretilmiş. İçeriği geçerli olabilir; hangi sürümle hazırlandığı kayıtlı değil.",
        ton: "notr",
      };
  }
}
