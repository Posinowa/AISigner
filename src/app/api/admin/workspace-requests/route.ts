import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { bekleyenTalepleriGetir } from "@/features/workspace-requests/server/talep";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * Bekleyen çalışma alanı talepleri kuyruğu (#349).
 *
 * Kuyruğun GÖRÜNÜR olması bu özelliğin tüm amacı: talep kaydı darboğazı
 * kaldırmıyor, takip edilebilir kılıyor. Fark edilmeyen bir kuyruk, darboğazı
 * yalnızca yer değiştirmiş olur.
 */
export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    return NextResponse.json({ talepler: await bekleyenTalepleriGetir() });
  } catch (error) {
    rotaHatasi("GET /api/admin/workspace-requests error:", error);
    return NextResponse.json(
      { error: "Talepler yüklenirken hata oluştu" },
      { status: 500 },
    );
  }
}
