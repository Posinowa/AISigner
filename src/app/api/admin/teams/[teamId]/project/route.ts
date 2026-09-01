import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { assignTeamProjectSchema } from "@/lib/validations/api";
import { takimaProjeAta, ASGARI_UYE, type TakimHatasi } from "@/features/teams/server/takim";

/**
 * Takıma proje atar (#332 Faz 2).
 *
 * Bu, takım için TEK `AssignedProject` kaydını yaratır — tek roadmap, tek repo.
 * GitHub kurulumu ayrı bir adım (#349 talep akışı ya da admin panelinden).
 */
const DURUM: Partial<Record<TakimHatasi, number>> = {
  "takim-yok": 404,
  "sablon-yok": 404,
  "yetersiz-uye": 400,
  "zaten-atanmis": 409,
};

const MESAJ: Partial<Record<TakimHatasi, string>> = {
  "takim-yok": "Takım bulunamadı.",
  "sablon-yok": "Proje şablonu bulunamadı.",
  "yetersiz-uye": `Takım projesi için en az ${ASGARI_UYE} aktif üye gerekli.`,
  "zaten-atanmis": "Bu proje takıma zaten atanmış.",
};

export async function POST(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { teamId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = assignTeamProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const sonuc = await takimaProjeAta({ teamId, projectTemplateId: parsed.data.projectTemplateId });
    if (!sonuc.ok) {
      return NextResponse.json(
        { error: MESAJ[sonuc.neden] ?? "Proje atanamadı." },
        { status: DURUM[sonuc.neden] ?? 400 },
      );
    }
    return NextResponse.json(sonuc.veri, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/teams/[teamId]/project error:", error);
    return NextResponse.json({ error: "Proje atanamadı." }, { status: 500 });
  }
}
