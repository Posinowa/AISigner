import "server-only";
import { unstable_cache } from "next/cache";
import {
  darbogazAnalizi,
  mentorYanitSuresi,
  riskliOgrenciler,
  type DarbogazSatiri,
  type YanitSuresi,
  type RiskliOgrenci,
} from "./analiz";

/**
 * Analitik panelin tek giriş noktası (#331).
 *
 * ⚠️ ÖNBELLEK ZORUNLU, SÜS DEĞİL. Üç ağır toplama sorgusu her sayfa açılışında
 * koşarsa panel, izlemeye çalıştığı sistemi yavaşlatan şeye dönüşür (#313'te
 * `conversations` N+1'iyle yaşanan sorun). Süre 5 dakika: darboğaz ve yanıt
 * süresi günler ölçeğinde değişen büyüklükler, dakikalık tazelik gereksiz.
 *
 * KAPSAM ROLE GÖRE DARALIYOR:
 *   admin  → tüm platform
 *   mentör → yalnızca KENDİ öğrencileri ve KENDİ yanıt süresi
 *
 * Mentörün yanıt süresi bir performans ölçümü; mentörleri birbiriyle
 * karşılaştıran bir sıralama bilerek YOK. Mentör kendi sayısını görür.
 */

const ONBELLEK_SANIYE = 300;

export type PanelVerisi = {
  darbogazlar: DarbogazSatiri[];
  yanitSureleri: YanitSuresi[];
  riskliler: RiskliOgrenci[];
  uretildi: string;
};

/**
 * @param mentorUserId verilirse kapsam o mentörle sınırlanır; verilmezse
 *   platform geneli (yalnızca admin çağırmalı).
 */
export function panelVerisiGetir(mentorUserId?: string): Promise<PanelVerisi> {
  // Önbellek anahtarı kapsamı İÇERMELİ: aksi halde bir mentörün dar sonucu
  // admin'e, ya da bir mentörün verisi başka bir mentöre servis edilirdi.
  const anahtar = mentorUserId ? `analitik-mentor-${mentorUserId}` : "analitik-platform";

  return unstable_cache(
    async () => {
      // Üçü paralel: birbirini beklemelerinin bir nedeni yok.
      const [darbogazlar, yanitSureleri, riskliler] = await Promise.all([
        darbogazAnalizi(mentorUserId),
        mentorYanitSuresi(mentorUserId),
        riskliOgrenciler(mentorUserId),
      ]);

      return {
        darbogazlar,
        yanitSureleri,
        riskliler,
        // Arayüz "ne kadar taze" diyebilsin: önbellekli veriyi canlıymış gibi
        // göstermek, admin'in az önceki değişikliği görmemesine yol açar.
        uretildi: new Date().toISOString(),
      };
    },
    [anahtar],
    { revalidate: ONBELLEK_SANIYE, tags: [anahtar] },
  )();
}
