import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { revizyonIsteSchema } from "@/lib/validations/api";
import { revizyonIste } from "@/features/roadmap/server/revizyon";
import { revizyonuGitHubaYansit } from "@/features/github/server/revizyon-senk";
import { logger } from "@/lib/logger";

/**
 * POST /api/mentor/steps/[stepId]/revizyon — mentör onay kapısı (#379).
 *
 * ⚠️ Mentörün adım durumunu SERBESTÇE değiştirmesi hâlâ kapalı
 * (`delete safeData.status`, mentor/roadmap uçları). Bu uç yalnızca TEK bir
 * geçişi açıyor: COMPLETED → REVISION_REQUESTED.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> },
) {
  const auth = await requireAuth(["MENTOR", "ADMIN"]);
  if (!auth.authorized) return auth.response;

  const { stepId } = await params;

  const govde = await req.json().catch(() => null);
  const parsed = revizyonIsteSchema.safeParse(govde);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sonuc = await revizyonIste({
    stepId,
    isteyenUserId: auth.session.user.id!,
    isteyenRol: auth.session.user.role as string,
    gerekce: parsed.data.gerekce,
  });

  if (!sonuc.ok) {
    const durum =
      sonuc.neden === "adim-yok" || sonuc.neden === "yetki-yok"
        ? 404
        : sonuc.neden === "mezun"
          ? 403
          : 400;
    // "yetki-yok" da 404 dönüyor: başkasının adımının VAR OLDUĞU bile sızmasın.
    const mesajlar: Record<string, string> = {
      "adim-yok": "Adım bulunamadı.",
      "yetki-yok": "Adım bulunamadı.",
      tamamlanmamis: "Yalnızca tamamlanmış bir adım revizyona döndürülebilir.",
      "gerekce-gerekli": "Revizyon gerekçesi zorunludur.",
      mezun: "Mezun olmuş bir stajyerin adımı revizyona döndürülemez.",
    };
    return NextResponse.json({ error: mesajlar[sonuc.neden] }, { status: durum });
  }

  /*
   * GitHub senkronu ARKA PLANDA (#349 deseni).
   *
   * Platform durumu tek doğru kaynak; ağ çağrısı yanıtı bekletmemeli ve
   * başarısızlığı revizyonu geri almamalı — aksi halde GitHub erişilemezken
   * mentör revizyon isteyemezdi.
   */
  after(async () => {
    try {
      const senk = await revizyonuGitHubaYansit({ stepId, gerekce: parsed.data.gerekce });
      logger.info("Revizyon GitHub'a yansıtıldı", { stepId, ...senk });
    } catch (error) {
      logger.error("Revizyon GitHub senkronu başarısız", {
        stepId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return NextResponse.json({ ok: true, stepId: sonuc.stepId }, { status: 200 });
}
