import { AlertCircle } from "lucide-react";
import {
  ilerlemeHesapla,
  duraklamaMetni,
  type IlerlemeAdimi,
} from "@/features/progress/ilerleme";

/**
 * Bir projenin ilerlemesi + duraklama sinyali (#432).
 *
 * ⚠️ Hesap ORTAK MODÜLDEN. Admin atama sayfası ve mentör panosu aynı soruyu
 * soruyor; iki ayrı hesap, biri güncellenip diğeri unutulunca farklı cevap
 * verirdi (#367/#370/#376/#393'ün hata sınıfı).
 *
 * ⚠️ SKOR DEĞİL SİNYAL (#331/#397). Duraklama metni verinin kendisi:
 * "12 gündür hareket yok". Uydurma bir risk yüzdesi üretilmiyor.
 */
export function IlerlemeSeridi({
  adimlar,
  taslakMi = false,
}: {
  adimlar: IlerlemeAdimi[];
  /** Taslak yol haritasında öğrenci adımları göremiyor (#405). */
  taslakMi?: boolean;
}) {
  // ⚠️ "Adım yok" ile "hiç ilerlemedi" AYRI şeyler. Yol haritası çizilmemişse
  // %0'lık boş bir çubuk göstermek, işin başlamadığını değil ilerlemediğini
  // söylerdi.
  if (adimlar.length === 0) {
    return <p className="text-[11px] text-slate-400">Yol haritası çizilmemiş</p>;
  }

  const { yuzde, tamamlanan, toplamAdim } = ilerlemeHesapla(adimlar);
  const duraklama = duraklamaMetni(adimlar);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-600">
          {tamamlanan}/{toplamAdim} adım
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-slate-700">%{yuzde}</span>
      </div>

      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            yuzde === 100 ? "bg-emerald-500" : "bg-blue-500"
          }`}
          style={{ width: `${yuzde}%` }}
        />
      </div>

      {/* #405: Taslakken stajyer adımları göremiyor — ilerleme onun için
          henüz görünmez bir sayı. Sebebi burada da yazılı. */}
      {taslakMi && (
        <p className="mt-1 text-[11px] text-amber-700">Taslak — stajyer henüz göremiyor</p>
      )}

      {duraklama && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {duraklama}
        </p>
      )}
    </div>
  );
}
