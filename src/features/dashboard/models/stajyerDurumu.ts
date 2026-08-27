import type { SiradakiEylem } from "@/features/dashboard/ui/PanelKarsilama";

/**
 * #290: Stajyerin panele girdiğinde göreceği durum cümlesi ve SIRADAKİ eylem.
 *
 * Önceden yalnızca durum cümlesi vardı ve sayfanın içine gömülü iç içe üçlü
 * bir koşuldu; kullanıcıya "ne yapmalıyım" sorusunun cevabı hiç verilmiyordu.
 * Burası o kararı tek yerde ve test edilebilir biçimde topluyor.
 *
 * Sıra ÖNEMLİ: mezuniyet her şeyin önünde, sonra elde iş var mı, sonra
 * beklenen bir şey var mı. Kullanıcıya aynı anda tek bir sıradaki iş
 * gösterilir — ikisi birden gösterilseydi hangisinin önce olduğu kaybolurdu.
 */

export type StajyerDurumGirdisi = {
  mezun: boolean;
  projeSayisi: number;
  mentorSayisi: number;
  /** Tamamlanmamış ilk adım. Yoksa null. */
  siradakiAdim: { baslik: string; projeAdi: string } | null;
};

export type StajyerDurumu = {
  durum: string;
  siradaki: SiradakiEylem | null;
};

/** Panel içindeki projeler bölümünün çapası. */
export const PROJELER_CAPASI = "#projeler";
const MESAJLAR = "/student-dashboard/messages";

export function stajyerDurumu(girdi: StajyerDurumGirdisi): StajyerDurumu {
  if (girdi.mezun) {
    return {
      durum:
        "Staj sürecin boyunca geliştirdiğin projeler, tamamlanan adımlar ve çıktılar aşağıda arşivlendi.",
      // Mezun için bekleyen bir iş yok; uydurma bir eylem göstermek yanıltıcı olurdu.
      siradaki: null,
    };
  }

  if (girdi.siradakiAdim) {
    return {
      durum: "Çalışma masan hazır.",
      siradaki: {
        etiket: girdi.siradakiAdim.baslik,
        aciklama: `${girdi.siradakiAdim.projeAdi} · sıradaki adım`,
        href: PROJELER_CAPASI,
      },
    };
  }

  if (girdi.projeSayisi > 0) {
    return {
      durum: "Atanan adımların hepsini tamamladın.",
      siradaki: {
        etiket: "Mentörüne haber ver",
        aciklama: "Sıradaki adımlar için değerlendirme bekleniyor",
        href: MESAJLAR,
      },
    };
  }

  if (girdi.mentorSayisi > 0) {
    return {
      durum: "Mentörün gelişim planını hazırlıyor.",
      siradaki: {
        etiket: "Mentörünle tanış",
        aciklama: "Hedeflerini yazarsan plan sana daha çok benzer",
        href: MESAJLAR,
      },
    };
  }

  return {
    durum: "Profilin inceleniyor. Yakında bir mentörle eşleştirileceksin.",
    // Eşleştirmeyi stajyer hızlandıramaz; burada eylem göstermek boş vaat olur.
    siradaki: null,
  };
}
