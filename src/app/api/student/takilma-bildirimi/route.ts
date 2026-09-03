import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/**
 * POST /api/student/takilma-bildirimi — takılma bildirimi tercihi (#397).
 *
 * ⚠️ VARSAYILAN KAPALI. Posilog bugüne kadar yalnız YANIT veriyordu;
 * kendiliğinden yazmak yeni bir davranış ve istenmeyen bir temas taciz gibi
 * hissettirebilir. Bu yüzden stajyer açıkça açıyor.
 *
 * ⚠️ Bu ayar MENTÖR bildirimini etkilemez — o, öğrencinin tercihinden bağımsız
 * çalışır. Mentörün öğrencisinin takıldığını bilmesi, öğrencinin kendi
 * bildirim tercihine bağlanamaz.
 */

const schema = z.object({ acik: z.boolean() });

export async function POST(req: Request) {
  const auth = await requireAuth("STUDENT");
  if (!auth.authorized) return auth.response;

  const govde = await req.json().catch(() => null);
  const parsed = schema.safeParse(govde);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { count } = await prisma.studentProfile.updateMany({
    // Kapsam OTURUMDAN: profil kimliği istemciden alınmıyor.
    where: { userId: auth.session.user.id! },
    data: { takilmaBildirimi: parsed.data.acik },
  });

  if (count === 0) {
    return NextResponse.json({ error: "Öğrenci profili bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, acik: parsed.data.acik });
}
