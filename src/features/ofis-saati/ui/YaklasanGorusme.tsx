import Link from "next/link";
import { CalendarClock, Video } from "lucide-react";
import { tarihSaatBicimle } from "@/lib/tarih";

/**
 * Panodaki yaklaşan görüşme hatırlatması (#420).
 *
 * ⚠️ TAKVİMİN TAMAMI SAYFAYA TAŞINDI AMA BU KALDI. #398'de "rezerve edilmiş
 * bir görüşme zamana bağlı bilgidir; bir tıkın arkasına saklanırsa
 * kaçırılır" diye karar verilmişti. Bu yüzden panoda yalnızca REZERVASYONU
 * OLAN öğrenci kısa bir hatırlatma görüyor; rezervasyon yoksa hiçbir şey
 * basılmıyor — boş bir "görüşmen yok" kartı yer kaplamaktan başka bir şey
 * yapmaz (#290'daki ProfilTamamlaSeridi kararının aynısı).
 *
 * ⚠️ Görüşme bağlantısı sunucuda zaten yalnız REZERVE EDİLMİŞ slotta
 * dönüyor (#398 — canlı testte bulunmuş bir sızıntıydı). Burada ayrıca
 * filtrelenmiyor; tek doğruluk kaynağı sunucu.
 */

export type YaklasanSlot = {
  id: string;
  baslangic: Date;
  bitis: Date;
  mentorAdi: string;
  gorusmeLinki: string | null;
};

// #460: Saat dilimi AÇIKÇA veriliyor. Bu bileşen bir Server Component
// içinde render ediliyor ve üretimde konteyner UTC — öncesinde TR saatiyle
// 14:00'lik bir görüşme panoda 11:00 görünüyordu.
const saat = (d: Date) =>
  tarihSaatBicimle(d, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export function YaklasanGorusme({ slot }: { slot: YaklasanSlot | null }) {
  if (!slot) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {saat(slot.baslangic)} · {slot.mentorAdi}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">Yaklaşan mentör görüşmen</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {slot.gorusmeLinki && (
          <a
            href={slot.gorusmeLinki}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Video className="h-3.5 w-3.5" />
            Katıl
          </a>
        )}
        <Link
          href="/student-dashboard/ofis-saati"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Takvim
        </Link>
      </div>
    </div>
  );
}
