import type { SiradakiEylem } from "@/features/dashboard/ui/PanelKarsilama";

/**
 * #290: Mentörün panele girdiğinde göreceği durum cümlesi ve SIRADAKİ eylem.
 *
 * Önceden mentör panelinde ne durum cümlesi ne de sıradaki eylem vardı;
 * "Profil Eksik" bir istatistik kutusunda sayı olarak duruyordu. Sayı bir
 * ölçü, oysa o satır aslında bir GÖREV — üzerine gidilebilir olması gerekir.
 * Burası o görevi eyleme çeviriyor.
 *
 * Sıra ÖNEMLİ: profili eksik öğrenciye iyi proje atanamaz, o yüzden eksik
 * profil projesizlikten önce gelir.
 */

export type MentorDurumGirdisi = {
  ogrenciSayisi: number;
  profiliEksikSayisi: number;
  projesizSayisi: number;
};

export type MentorDurumu = {
  durum: string;
  siradaki: SiradakiEylem | null;
};

/** Panel içindeki öğrenci listesinin çapası. */
export const OGRENCILER_CAPASI = "#ogrenciler";
const SABLONLAR = "/mentor-dashboard/projects";

export function mentorDurumu(girdi: MentorDurumGirdisi): MentorDurumu {
  if (girdi.ogrenciSayisi === 0) {
    return {
      durum: "Henüz sana öğrenci atanmadı.",
      // Eşleştirmeyi mentör yapamıyor ama bekleme boş geçmesin: hazır
      // şablon, atama gelir gelmez işe yarar.
      siradaki: {
        etiket: "Proje şablonu hazırla",
        aciklama: "Öğrencin atandığında hazır bir yol haritan olsun",
        href: SABLONLAR,
      },
    };
  }

  if (girdi.profiliEksikSayisi > 0) {
    return {
      durum: `${girdi.ogrenciSayisi} öğrencin var.`,
      siradaki: {
        etiket: `${girdi.profiliEksikSayisi} öğrencinin profili eksik`,
        aciklama: "Profil tamamlanmadan uygun proje seçmek zor",
        href: OGRENCILER_CAPASI,
      },
    };
  }

  if (girdi.projesizSayisi > 0) {
    return {
      durum: `${girdi.ogrenciSayisi} öğrencin var.`,
      siradaki: {
        etiket: `${girdi.projesizSayisi} öğrenci proje bekliyor`,
        aciklama: "Aktif projesi olmayan öğrencilerin var",
        href: OGRENCILER_CAPASI,
      },
    };
  }

  return {
    durum: `${girdi.ogrenciSayisi} öğrencinin de aktif projesi var.`,
    // Bekleyen bir iş yok; uydurma bir eylem göstermek gürültü olurdu.
    siradaki: null,
  };
}
