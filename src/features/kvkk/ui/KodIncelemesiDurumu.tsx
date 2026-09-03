import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { KodIncelemesiDurumu } from "@/features/kvkk/kod-incelemesi-durumu";

/**
 * Mentöre AI kod incelemesinin durumu (#394).
 *
 * ⚠️ NEDEN VAR: Kural (takımda herkesin güncel rızası) doğru ve
 * gevşetilmiyor — ortak repoda kimin hangi satırı yazdığı bilinmiyor. Eksik
 * olan SESSİZLİKTİ: engelleme hiç kimseye söylenmiyordu. PR'ı açan öğrenci
 * incelemenin neden gelmediğini bilmiyor, mentör de durumu göremiyordu.
 *
 * ⚠️ İSİMLER YALNIZ MENTÖR YÜZEYİNDE. Durumu düzeltebilecek kişi rıza
 * vermemiş üye, ama onu takip edebilecek kişi mentör. Üyeler arasında isim
 * paylaşmak baskı yaratır ve rıza "özgür iradeyle" verilmiş olmaktan çıkardı
 * (#352 gerekçesi).
 *
 * ⚠️ AÇIKKEN DE GÖSTERİLİYOR ama sessizce: mentör "çalışıyor mu" sorusunu
 * yanıtsız bırakmasın. Kapalıyken uyarı rengi, açıkken nötr.
 */
export function KodIncelemesiDurumuRozeti({
  durum,
  githubStatus,
}: {
  durum: KodIncelemesiDurumu;
  githubStatus: string;
}) {
  /*
   * ⚠️ BAGLA/LINKED depolarda kod incelemesi ZATEN çalışmıyor (#366): depo
   * stajyerin hesabında, webhook gelmiyor ve `GITHUB_TOKEN` orada yetkisiz.
   * Orada rıza durumunu göstermek yanlış sebebi işaret ederdi.
   */
  if (githubStatus === "LINKED") {
    return (
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Bu depo stajyerin hesabında olduğu için AI kod incelemesi çalışmıyor
        (bağlanan depolarda webhook kurulamıyor).
      </p>
    );
  }

  if (durum.acikMi) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        AI kod incelemesi açık.
      </p>
    );
  }

  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0 text-xs leading-relaxed text-amber-900">
        <p className="font-semibold">AI kod incelemesi kapalı.</p>
        {durum.sahipYok ? (
          <p className="mt-0.5">Bu atamanın sahibi bulunamadı.</p>
        ) : (
          <>
            <p className="mt-0.5">
              {/* Takımda TEK bir eksik rıza tüm incelemeyi durdurur; sebebi
                  ortak repoda kimin hangi satırı yazdığının bilinmemesi. */}
              Açık rızası güncel olmayan{" "}
              {durum.rizasiEksikler.length === 1 ? "bir üye" : "üyeler"} var:{" "}
              <span className="font-medium">
                {durum.rizasiEksikler.map((k) => k.ad).join(", ")}
              </span>
              .
            </p>
            <p className="mt-1 text-amber-800/90">
              Ortak depoda hangi satırı kimin yazdığı bilinmediği için, bir üyenin
              kodu bile rızasız dışarı çıkmasın diye inceleme hiç yapılmıyor. Üye
              profilinden rızayı güncellediğinde kendiliğinden açılır.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
