import { rotaHatasi } from "@/lib/api-hata";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { decideWorkspaceRequestSchema } from "@/lib/validations/api";
import {
  talebiKararaBagla,
  type KararHatasi,
} from "@/features/workspace-requests/server/talep";

/**
 * Talebi karara bağlar (#349).
 *
 * Onay, kurulumu `baslatGitHubWorkspaceKurulumu` üzerinden başlatır — o
 * fonksiyondaki atomik `PROVISIONING` kilidi (#318) ATLANMAZ. Kilidi atlayan
 * bir kestirme, iki eşzamanlı onayın iki kurulum başlatmasına ve GitHub'a
 * mükerrer repo/issue isteklerine yol açardı.
 */

const DURUM: Record<KararHatasi, number> = {
  "talep-yok": 404,
  // İstek geçerliydi, durum uygun değildi — sunucu hatası değil.
  "zaten-karara-baglanmis": 409,
  "kurulum-suruyor": 409,
  "gerekce-gerekli": 400,
};

const MESAJ: Record<KararHatasi, string> = {
  "talep-yok": "Talep bulunamadı.",
  "zaten-karara-baglanmis": "Bu talep zaten karara bağlanmış.",
  "kurulum-suruyor": "Kurulum başlatılamadı.",
  "gerekce-gerekli": "Reddederken gerekçe yazmanız gerekiyor.",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { requestId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = decideWorkspaceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const sonuc = await talebiKararaBagla({
      requestId,
      adminUserId: auth.session.user.id!,
      onay: parsed.data.onay,
      adminNote: parsed.data.adminNote ?? null,
    });

    if (!sonuc.ok) {
      return NextResponse.json(
        // `kurulum-suruyor` kendi mesajını taşıyor: admin'e "zaten sürüyor" ile
        // "token yok" arasındaki farkı söylemek gerekiyor.
        { error: sonuc.mesaj ?? MESAJ[sonuc.neden] },
        { status: DURUM[sonuc.neden] },
      );
    }

    // Onayda kurulum arka planda sürüyor: 202 Accepted (admin/assignments ile
    // aynı sözleşme). Redde iş bitmiştir: 200.
    return NextResponse.json(sonuc, { status: sonuc.kurulumBaslatildi ? 202 : 200 });
  } catch (error) {
    rotaHatasi("POST /api/admin/workspace-requests/[requestId] error:", error);
    return NextResponse.json({ error: "Talep işlenirken hata oluştu" }, { status: 500 });
  }
}
