import { ONERI_SINIRLARI } from "@/lib/validations/api";

/**
 * Öneri formundaki asgari karakter geri bildirimi (#408).
 *
 * ⚠️ SINIRLAR ŞEMADAN GELİYOR (`ONERI_SINIRLARI`). Forma elle yazılan bir
 * "30", biri değiştirilip diğeri unutulduğunda sessizce ayrışır ve kullanıcıya
 * yanlış bir eşik gösterilir.
 *
 * ⚠️ KIRPILMIŞ uzunluk sayılıyor — şema da öyle doğruluyor (`.trim()` zincirin
 * başında). Ham uzunluğu saymak, 35 boşluk yazan kullanıcıya "yeterli" derken
 * sunucunun reddetmesine yol açardı.
 */

export type SayacDurumu = {
  uzunluk: number;
  enAz: number;
  yeterliMi: boolean;
  metin: string;
};

export function sayacDurumu(deger: string, enAz: number): SayacDurumu {
  const uzunluk = deger.trim().length;
  const yeterliMi = uzunluk >= enAz;

  return {
    uzunluk,
    enAz,
    yeterliMi,
    // Yeterli olduktan sonra eşiği tekrarlamak gürültü; yalnız sayı kalıyor.
    metin: yeterliMi ? `${uzunluk} karakter` : `${uzunluk} / en az ${enAz} karakter`,
  };
}

/**
 * Form gönderilebilir mi.
 *
 * ⚠️ Bu bir KOLAYLIK, güvenlik değil: sunucu aynı kuralları zaten
 * doğruluyor. Amaç kullanıcıyı gönderdikten sonra hata almaktan kurtarmak.
 */
export function formGonderilebilir(params: {
  title: string;
  description: string;
  goals: string;
}): boolean {
  return (
    sayacDurumu(params.title, ONERI_SINIRLARI.baslik.enAz).yeterliMi &&
    sayacDurumu(params.description, ONERI_SINIRLARI.aciklama.enAz).yeterliMi &&
    sayacDurumu(params.goals, ONERI_SINIRLARI.hedefler.enAz).yeterliMi
  );
}
