import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { adimiTasi } from "@/features/roadmap/server/siralama";
import { adimTasiSchema } from "@/lib/validations/api";

/**
 * Adımı bir sıra yukarı/aşağı taşır (#406).
 *
 * Ayrı bir uç: mevcut `PUT .../steps/[stepId]` adımın TEK BAŞINA `order`
 * alanını kabul ediyor, bu da komşusunu güncellemeden sıra yazmaya izin
 * verirdi (iki adım aynı sırada kalırdı). Taşıma işlemi doğası gereği
 * yol haritasının TAMAMINI ilgilendiriyor.
 */
const MESAJLAR: Record<string, string> = {
  "yol-haritasi-yok": "Yol haritası bulunamadı.",
  "yetki-yok": "Bu yol haritasını düzenleme yetkiniz yok.",
  "adim-yok": "Adım bulunamadı.",
  sinirda: "Adım zaten listenin ucunda.",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string }> },
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const { roadmapId } = await params;
  const govde = await req.json().catch(() => null);
  const parsed = adimTasiSchema.safeParse(govde);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sonuc = await adimiTasi({
    roadmapId,
    stepId: parsed.data.stepId,
    yon: parsed.data.yon,
    mentorUserId: auth.session.user.id!,
  });

  if (!sonuc.ok) {
    const durum =
      sonuc.neden === "yetki-yok" ? 403 : sonuc.neden === "sinirda" ? 400 : 404;
    return NextResponse.json({ error: MESAJLAR[sonuc.neden] }, { status: durum });
  }

  return NextResponse.json({ ok: true, ...sonuc.veri });
}
