import { Loader2 } from "lucide-react";

/**
 * Kök yükleme sınırı (suspense fallback). Sunucu bileşeni içeren rotalar
 * (örn. force-dynamic student-dashboard) yüklenirken boş ekran yerine gösterilir.
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin h-7 w-7 text-blue-600" />
      <span className="ml-3 text-slate-600 font-medium">Yükleniyor...</span>
    </div>
  );
}
