import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { panelVerisiGetir } from "@/features/analytics/server/panel";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * Mentörün kendi analitiği (#331).
 *
 * ⚠️ KAPSAM OTURUMDAN GELİR, İSTEKTEN DEĞİL. Mentör kimliği sorgu
 * parametresinden alınsaydı, herhangi bir mentör başka bir mentörün
 * öğrencilerini ve yanıt süresini okuyabilirdi.
 */
export async function GET() {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    return NextResponse.json(await panelVerisiGetir(auth.session.user.id!));
  } catch (error) {
    rotaHatasi("GET /api/mentor/analytics error:", error);
    return NextResponse.json({ error: "Analitik veriler yüklenemedi." }, { status: 500 });
  }
}
