import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { setTeamMentorsSchema } from "@/lib/validations/api";
import { mentorleriAyarla } from "@/features/teams/server/takim";

/**
 * Takımın mentörlerini ayarlar (#332 Faz 2).
 *
 * Gövde TAM KÜMEYİ taşır (öğrenci mentör atamasındaki `setStudentMentors`
 * deseniyle aynı): kısmi ekleme/çıkarma iki isteğin arasında tutarsız bir
 * ara duruma yol açardı.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { teamId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = setTeamMentorsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const sonuc = await mentorleriAyarla({ teamId, mentorIds: parsed.data.mentorIds });
    if (!sonuc.ok) {
      return NextResponse.json(
        {
          error:
            sonuc.neden === "mentor-degil"
              ? "Yalnızca MENTOR rolündeki kullanıcılar takım mentörü olabilir."
              : "Takım bulunamadı.",
        },
        { status: sonuc.neden === "mentor-degil" ? 400 : 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/admin/teams/[teamId]/mentors error:", error);
    return NextResponse.json({ error: "Mentörler ayarlanamadı." }, { status: 500 });
  }
}
