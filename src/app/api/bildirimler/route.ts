import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import {
  bildirimleriGetir,
  okunmamisSayisi,
  okunduIsaretle,
} from "@/features/bildirim/server/bildirim";

/**
 * Bildirimler (#380).
 *
 * ⚠️ KAPSAM HER ZAMAN OTURUMDAN. `userId` istemciden ALINMIYOR; aksi halde
 * herkes başkasının bildirimlerini okuyabilirdi.
 */

export async function GET() {
  const auth = await requireAuth(["ADMIN", "MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;
  const [bildirimler, okunmamis] = await Promise.all([
    bildirimleriGetir(userId),
    okunmamisSayisi(userId),
  ]);

  return NextResponse.json({ bildirimler, okunmamis });
}

const okunduSchema = z.object({
  /** Boş/eksikse TÜMÜ okundu sayılır. */
  ids: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth(["ADMIN", "MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const govde = await req.json().catch(() => ({}));
  const parsed = okunduSchema.safeParse(govde);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sayi = await okunduIsaretle(auth.session.user.id!, parsed.data.ids);
  return NextResponse.json({ ok: true, okunan: sayi });
}
