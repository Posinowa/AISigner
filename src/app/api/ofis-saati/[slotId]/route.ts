import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { ofisSaatiRezerveSchema, gorusmeNotuSchema } from "@/lib/validations/api";
import {
  slotuRezerveEt,
  rezervasyonuIptalEt,
  slotuSil,
  gorusmeNotuKaydet,
} from "@/features/ofis-saati/server/ofis-saati";

/**
 * Tek slot işlemleri (#398).
 *
 * POST   — stajyer rezerve eder
 * PATCH  — mentör görüşme notunu yazar (AI karışmaz)
 * DELETE — rezervasyon iptali (iki taraf) veya boş slotun silinmesi (mentör)
 */

const MESAJLAR: Record<string, string> = {
  "gecmis-zaman": "Geçmiş bir slot rezerve edilemez.",
  "gecersiz-aralik": "Geçersiz aralık.",
  "cok-uzun": "Aralık çok uzun.",
  // "Yetki yok" da bu mesajı alır: başkasının takvimindeki bir slotun var
  // olduğu bile sızmamalı.
  "slot-yok": "Slot bulunamadı.",
  dolu: "Bu slot az önce başkası tarafından alındı.",
};

export async function POST(req: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const auth = await requireAuth("STUDENT");
  if (!auth.authorized) return auth.response;

  const { slotId } = await params;
  const govde = await req.json().catch(() => ({}));
  const parsed = ofisSaatiRezerveSchema.safeParse(govde);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sonuc = await slotuRezerveEt({
    slotId,
    studentUserId: auth.session.user.id!,
    not: parsed.data.not,
  });

  if (!sonuc.ok) {
    const durum = sonuc.neden === "slot-yok" ? 404 : sonuc.neden === "dolu" ? 409 : 400;
    return NextResponse.json({ error: MESAJLAR[sonuc.neden] }, { status: durum });
  }

  return NextResponse.json({ ok: true, ...sonuc.veri });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const { slotId } = await params;
  const govde = await req.json().catch(() => null);
  const parsed = gorusmeNotuSchema.safeParse(govde);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sonuc = await gorusmeNotuKaydet({
    slotId,
    mentorUserId: auth.session.user.id!,
    not: parsed.data.not,
  });

  if (!sonuc.ok) return NextResponse.json({ error: MESAJLAR[sonuc.neden] }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { slotId } = await params;
  const rol = auth.session.user.role as string;
  const userId = auth.session.user.id!;

  // `?tamamen=1` → mentör boş slotu tamamen siler. Aksi halde yalnız
  // rezervasyon iptal edilir ve slot yeniden boşa düşer.
  const tamamen = new URL(req.url).searchParams.get("tamamen") === "1";

  const sonuc =
    tamamen && rol === "MENTOR"
      ? await slotuSil({ slotId, mentorUserId: userId })
      : await rezervasyonuIptalEt({ slotId, userId, rol });

  if (!sonuc.ok) return NextResponse.json({ error: MESAJLAR[sonuc.neden] }, { status: 404 });
  return NextResponse.json({ ok: true });
}
