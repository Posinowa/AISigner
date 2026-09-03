import { ChevronDown, Settings2 } from "lucide-react";

/**
 * Her gün kullanılmayan idari araçları tek katlanır bölümde toplar (#415).
 *
 * ⚠️ ÖLÇÜMLE GELDİ. Öğrenci panosu 3 adımlık bir yol haritasıyla 3388px
 * (3.8 ekran) ve ilk adım kartı 2366px aşağıdaydı — 2.6 ekran. "Kendi
 * projeni öner" formu tek başına 745px, yani üç adım kartının toplamından
 * (706px) büyüktü.
 *
 * Kök sebep: sayfa kullanım sıklığına göre değil, ÖZELLİKLERİN EKLENME
 * SIRASINA göre dizilmişti. #397, #366 ve #398 geldiklerinde çalışma alanının
 * üstüne kondular; öğrencinin her gün yaptığı iş en alta itildi.
 *
 * ⚠️ SEKME (TAB) DEĞİL — bilinçli. Sekmeli bir çalışma alanı önerilmişti;
 * yeni bir gezinme modeli, derin bağlantı ve istemci durumu getiriyor,
 * üstelik öğrenci "her şey nerede" hissini kaybediyor. Katlanır blok aynı
 * kazancı sıfır gezinme değişikliğiyle veriyor.
 *
 * ⚠️ `<details>` KULLANILIYOR, istemci durumu DEĞİL. Sunucu bileşeni olarak
 * kalabiliyor, JavaScript olmadan çalışıyor ve klavye erişimi tarayıcıdan
 * geliyor. İçindeki istemci bileşenleri normal şekilde çocuk olarak duruyor.
 *
 * ⚠️ VARSAYILAN KAPALI ama içindekiler ÖZETTE SAYILIYOR. #397 takılma
 * bildirimi ayarını bilerek GÖRÜNÜR yere koymuştu: opt-in'in bilinen bedeli,
 * tam da çekingen stajyerin ayarı fark etmemesiydi. Ayarı sessizce gömmek o
 * kararı zayıflatırdı — bu yüzden özet satırı ayarın ADINI ve GÜNCEL
 * DURUMUNU yazıyor. Önceki hâlinden daha bilgilendirici: eskiden yalnız bir
 * anahtar duruyordu, şimdi kapalı olduğu kapalıyken bile okunuyor.
 */
export function IdariBolum({
  ozet,
  varsayilanAcik = false,
  children,
}: {
  /**
   * Katlanmış başlıkta sayılacak içerikler.
   *
   * ⚠️ İÇERİĞİ SEÇEN TARAF ÖZETİ DE KURAR. İlk sürüm listeyi burada
   * sabitliyordu ve mezun stajyerde özet "Kendi projeni öner" diyordu ama
   * form (doğru şekilde) hiç render edilmiyordu — başlık olmayan bir şeyi
   * duyuruyordu. Canlı testte bulundu. Tek karar noktası çağıran taraf.
   *
   * Takılma bildirimi (#397) burada ADIYLA ve DURUMUYLA yazılıyor: opt-in'in
   * bilinen bedeli, tam da çekingen stajyerin ayarı fark etmemesiydi.
   */
  ozet: string[];
  /**
   * Bekleyen bir iş varsa blok açık açılır.
   *
   * ⚠️ CANLI TESTTE BULUNDU. `ProfilTamamlaSeridi`'nin "Fotoğraf ekle"
   * bağlantısı `#profil` çapasına gidiyor ve o çapa artık bu bloğun
   * içinde. Kapalı bir `<details>` içindeki çapaya tıklamak Chrome 148'de
   * ne bloğu açtı ne de sayfayı kaydırdı (`scrollY` 0'da kaldı) — bağlantı
   * sessizce ölüyordu.
   *
   * Tarayıcının kendiliğinden açmasına GÜVENMİYORUZ; blok, bekleyen iş
   * varken zaten açık geliyor. Kural ayrıca kendi başına doğru: yapılacak
   * bir iş varsa onu bir tıkın arkasına saklamak istenmez.
   */
  varsayilanAcik?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={varsayilanAcik}
      className="group mb-8 rounded-2xl border border-slate-200/80 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <Settings2 className="h-4 w-4 shrink-0 text-slate-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Ayarlar ve öneriler</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{ozet.join(" · ")}</p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-6 border-t border-slate-100 p-4">{children}</div>
    </details>
  );
}
