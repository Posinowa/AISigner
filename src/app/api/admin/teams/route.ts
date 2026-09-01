import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { createTeamSchema } from "@/lib/validations/api";
import { takimlariGetir, takimOlustur } from "@/features/teams/server/takim";

/**
 * Takım listesi ve oluşturma (#332 Faz 2).
 *
 * ADMIN'e kapalı: takım kurmak, öğrencileri ortak bir panoya ve ortak bir
 * repoya bağlamak demek — bireysel atamalarla aynı yetki seviyesi.
 */
export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    return NextResponse.json({ takimlar: await takimlariGetir() });
  } catch (error) {
    console.error("GET /api/admin/teams error:", error);
    return NextResponse.json({ error: "Takımlar yüklenemedi." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const sonuc = await takimOlustur(parsed.data.name);
    return NextResponse.json(sonuc.ok ? sonuc.veri : {}, { status: sonuc.ok ? 201 : 400 });
  } catch (error) {
    console.error("POST /api/admin/teams error:", error);
    return NextResponse.json({ error: "Takım oluşturulamadı." }, { status: 500 });
  }
}
