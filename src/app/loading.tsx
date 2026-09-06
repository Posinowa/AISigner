import { PosinowaYukleniyor } from "@/features/brand/ui/PosinowaYukleniyor";

/**
 * Kök yükleme sınırı (suspense fallback). Sunucu bileşeni içeren rotalar
 * (örn. force-dynamic student-dashboard) yüklenirken boş ekran yerine gösterilir.
 */
export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50"
      role="status"
    >
      <PosinowaYukleniyor boyut={88} className="text-slate-900" dekoratif />
      <span className="text-slate-600 font-medium text-sm">Yükleniyor...</span>
    </div>
  );
}
