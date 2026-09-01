import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { addTeamMemberSchema } from "@/lib/validations/api";
import { uyeEkle, type TakimHatasi } from "@/features/teams/server/takim";

/** Takıma üye ekler (#332 Faz 2). */
const DURUM: Partial<Record<TakimHatasi, number>> = {
  "takim-yok": 404,
  "ogrenci-yok": 404,
  "ogrenci-degil": 400,
  "zaten-uye": 409,
  "takim-dolu": 409,
};

const MESAJ: Partial<Record<TakimHatasi, string>> = {
  "takim-yok": "Takım bulunamadı.",
  "ogrenci-yok": "Öğrenci bulunamadı.",
  "ogrenci-degil": "Yalnızca profili tamamlanmış stajyerler takıma eklenebilir.",
  "zaten-uye": "Bu stajyer zaten takımda.",
  "takim-dolu": "Takım dolu — en fazla 4 aktif üye olabilir.",
};

export async function POST(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { teamId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = addTeamMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const sonuc = await uyeEkle({ teamId, ...parsed.data });
    if (!sonuc.ok) {
      return NextResponse.json(
        { error: MESAJ[sonuc.neden] ?? "Üye eklenemedi." },
        { status: DURUM[sonuc.neden] ?? 400 },
      );
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/teams/[teamId]/members error:", error);
    return NextResponse.json({ error: "Üye eklenemedi." }, { status: 500 });
  }
}
